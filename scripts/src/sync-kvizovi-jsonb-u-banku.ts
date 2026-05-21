/**
 * REVERSE migracija: uzmi izmjene iz `kvizovi.pitanja` JSONB-a (gdje je
 * admin uređivao kroz legacy "Uredi kviz" modal na /kvizovi/:slug) i prepiši
 * odgovarajuće zapise u `pitanja_banka`.
 *
 * Strategija matchiranja po kvizu:
 *   1. text-match: ako je tekst pitanja nepromijenjen, pokupi se direktno
 *      iz banke (po normalizovanom `pitanje`).
 *   2. pozicijski fallback: ako je tekst mijenjan, koristi se postojeća
 *      `kviz_pitanja` veza (banka entry koji je već linkan na taj kviz na
 *      toj poziciji, sortirano po redoslijed).
 *
 * BACKUP — prije ažuriranja se snima JSON snapshot trenutne banke u
 * .local/banka-backup-<timestamp>.json (samo lokalno; ne commit-uje se).
 *
 * Pokreni:
 *   pnpm --filter @workspace/scripts exec tsx ./src/sync-kvizovi-jsonb-u-banku.ts
 *   pnpm --filter @workspace/scripts exec tsx ./src/sync-kvizovi-jsonb-u-banku.ts --dry-run
 *
 * Na produkciji: pokreni isto, samo sa DATABASE_URL koji pokazuje na prod DB.
 */
import { db, kvizoviTable, pitanjaBankaTable, kvizPitanjaTable } from "@workspace/db";
import { and, eq, sql, ne } from "drizzle-orm";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

type LegacyPitanje = {
  question: string;
  options?: string[];
  answer?: string;
  explanation?: string;
  image?: string;
  slika?: string;
  type?: string;
  items?: { text: string; order: number }[];
  template?: string[];
  words?: string[];
  correct?: string[];
  text?: string;
  incorrect?: string[];
};

type Vrsta = "single" | "multiple" | "truefalse" | "reorder" | "dragDrop" | "markWords";
type Meta = {
  template?: string[];
  words?: string[];
  correct?: string[];
  text?: string;
  incorrect?: string[];
} | null;

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

interface ParsedPitanje {
  pitanje: string;
  vrsta: Vrsta;
  opcije: string[];
  correctIndex: number;
  correctIndexes: number[] | null;
  correctOrder: number[] | null;
  meta: Meta;
  objasnjenje: string;
  slika: string | null;
}

function parseLegacy(p: LegacyPitanje, ctx: string): ParsedPitanje | null {
  if (!p?.question) return null;
  const pitanjeText = normalize(p.question);
  const tipRaw = (p.type ?? "").toLowerCase();
  const slika = (p.slika ?? p.image ?? null) || null;
  const objasnjenje = p.explanation ?? "";

  if (tipRaw === "reorder") {
    if (!Array.isArray(p.items) || p.items.length < 2) {
      console.warn(`  ${ctx} reorder bez items — preskačem`);
      return null;
    }
    const opcije = p.items.map((it) => normalize(it.text ?? ""));
    const correctOrder = p.items.map((it) => Number(it.order) || 0);
    if (opcije.some((o) => !o) || correctOrder.some((o) => o <= 0)) {
      console.warn(`  ${ctx} reorder invalid — preskačem`);
      return null;
    }
    return { pitanje: pitanjeText, vrsta: "reorder", opcije, correctIndex: 0, correctIndexes: null, correctOrder, meta: null, objasnjenje, slika };
  }
  if (tipRaw === "truefalse") {
    const a = normalize(p.answer ?? "").toLowerCase();
    const yes = ["da", "tačno", "tacno", "true", "yes", "ispravno"];
    return { pitanje: pitanjeText, vrsta: "truefalse", opcije: ["Da", "Ne"], correctIndex: yes.includes(a) ? 0 : 1, correctIndexes: null, correctOrder: null, meta: null, objasnjenje, slika };
  }
  if (tipRaw === "dragdrop") {
    const template = Array.isArray(p.template) ? p.template.map(String) : [];
    const words = Array.isArray(p.words) ? p.words.map(String) : [];
    const correct = Array.isArray(p.correct) ? p.correct.map(String) : [];
    const dropCount = template.filter((t) => t === "DROP").length;
    if (template.length === 0 || words.length === 0 || dropCount === 0 || correct.length !== dropCount) {
      console.warn(`  ${ctx} dragDrop invalid — preskačem`);
      return null;
    }
    return { pitanje: pitanjeText, vrsta: "dragDrop", opcije: [], correctIndex: 0, correctIndexes: null, correctOrder: null, meta: { template, words, correct }, objasnjenje, slika };
  }
  if (tipRaw === "markwords") {
    const words = Array.isArray(p.words) ? p.words.map(String) : [];
    const incorrect = Array.isArray(p.incorrect) ? p.incorrect.map(String) : [];
    const text = typeof p.text === "string" ? p.text : "";
    if (!words.length || !incorrect.length) {
      console.warn(`  ${ctx} markWords invalid — preskačem`);
      return null;
    }
    return { pitanje: pitanjeText, vrsta: "markWords", opcije: [], correctIndex: 0, correctIndexes: null, correctOrder: null, meta: { text, words, incorrect }, objasnjenje, slika };
  }
  // single / multiple / radio / checkbox
  if (!Array.isArray(p.options) || p.options.length === 0) {
    console.warn(`  ${ctx} bez opcija — preskačem`);
    return null;
  }
  const answerParts = (p.answer ?? "").includes("|||")
    ? p.answer!.split("|||").map(normalize).filter(Boolean)
    : [normalize(p.answer ?? "")];
  const idxs: number[] = [];
  for (const part of answerParts) {
    const idx = p.options.findIndex((o) => normalize(o) === part);
    if (idx >= 0 && !idxs.includes(idx)) idxs.push(idx);
  }
  if (idxs.length === 0) {
    console.warn(`  ${ctx} odgovor "${p.answer}" nije u opcijama — preskačem`);
    return null;
  }
  const isMulti = idxs.length > 1 || tipRaw === "checkbox" || tipRaw === "multiple";
  return {
    pitanje: pitanjeText,
    vrsta: isMulti ? "multiple" : "single",
    opcije: p.options,
    correctIndex: idxs[0]!,
    correctIndexes: isMulti ? idxs : null,
    correctOrder: null,
    meta: null,
    objasnjenje,
    slika,
  };
}

export interface ConflictDetail {
  ctx: string;
  kvizId: number;
  kvizSlug: string;
  kvizNaslov: string;
  pjIdx: number;
  targetBankaId: number;
  targetBankaText: string;
  newText: string;
  conflictBankaId?: number;
  reason: "duplicate_text" | "db_error";
  error?: string;
}

export interface SyncResult {
  kvizovaObradjeno: number;
  pitanjaUkupno: number;
  matchByText: number;
  matchByLink: number;
  noMatch: number;
  updated: number;
  unchanged: number;
  skipped: number;
  conflicts: number;
  conflictDetails: ConflictDetail[];
}

export async function syncKvizoviUBanku(opts: { silent?: boolean; dryRun?: boolean; skipBackup?: boolean } = {}): Promise<SyncResult> {
  const log = opts.silent ? () => {} : (...a: any[]) => console.log(...a);
  const dryRun = !!opts.dryRun;

  log(`[sync] počinjem ${dryRun ? "(DRY-RUN)" : ""}...`);

  // Snapshot backup banke prije bilo kakvih izmjena.
  const allBank = await db.select().from(pitanjaBankaTable);
  if (!dryRun && !opts.skipBackup) {
    const backupPath = `.local/banka-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(backupPath, JSON.stringify(allBank, null, 2));
    log(`[sync] backup banke (${allBank.length} pitanja) → ${backupPath}`);
  }

  const kvizovi = await db.select({
    id: kvizoviTable.id,
    slug: kvizoviTable.slug,
    naslov: kvizoviTable.naslov,
    pitanja: kvizoviTable.pitanja,
  }).from(kvizoviTable);

  log(`[sync] ${kvizovi.length} kvizova\n`);

  const r: SyncResult = {
    kvizovaObradjeno: 0,
    pitanjaUkupno: 0,
    matchByText: 0,
    matchByLink: 0,
    noMatch: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    conflicts: 0,
    conflictDetails: [],
  };

  for (const k of kvizovi) {
    const pitanjaJsonb = (k.pitanja ?? []) as LegacyPitanje[];
    if (pitanjaJsonb.length === 0) continue;
    r.kvizovaObradjeno++;

    // Linkana banka pitanja za ovaj kviz, sortirano po redoslijed.
    const links = await db
      .select({
        bankaId: pitanjaBankaTable.id,
        bankaPitanje: pitanjaBankaTable.pitanje,
        redoslijed: kvizPitanjaTable.redoslijed,
      })
      .from(kvizPitanjaTable)
      .innerJoin(pitanjaBankaTable, eq(kvizPitanjaTable.pitanjeId, pitanjaBankaTable.id))
      .where(eq(kvizPitanjaTable.kvizId, k.id))
      .orderBy(kvizPitanjaTable.redoslijed);

    const linkedIds = new Set(links.map((l) => l.bankaId));
    const usedLinkIdxs = new Set<number>();

    // Pass 1: text-match
    type PendingUpdate = { bankaId: number; parsed: ParsedPitanje; via: "text" | "link"; ctx: string };
    const updates: PendingUpdate[] = [];
    const unmatchedPjIdxs: number[] = [];

    for (let i = 0; i < pitanjaJsonb.length; i++) {
      r.pitanjaUkupno++;
      const ctx = `[${k.slug}#${i}]`;
      const parsed = parseLegacy(pitanjaJsonb[i]!, ctx);
      if (!parsed) {
        r.skipped++;
        continue;
      }
      // Tražimo text-match u linkanim entry-jima (sigurnije od globalnog text-matcha
      // jer izbjegavamo pogađanje pitanja iz drugih kvizova sa istim tekstom).
      let matchIdx = -1;
      for (let j = 0; j < links.length; j++) {
        if (usedLinkIdxs.has(j)) continue;
        if (normalize(links[j]!.bankaPitanje) === parsed.pitanje) {
          matchIdx = j;
          break;
        }
      }
      if (matchIdx >= 0) {
        usedLinkIdxs.add(matchIdx);
        updates.push({ bankaId: links[matchIdx]!.bankaId, parsed, via: "text", ctx });
        r.matchByText++;
      } else {
        unmatchedPjIdxs.push(i);
      }
    }

    // Pass 2: pozicijski fallback za neuparene JSONB pitanja
    const unmatchedLinks = links.filter((_, j) => !usedLinkIdxs.has(j));
    for (let m = 0; m < unmatchedPjIdxs.length; m++) {
      const pjIdx = unmatchedPjIdxs[m]!;
      const ctx = `[${k.slug}#${pjIdx}]`;
      const parsed = parseLegacy(pitanjaJsonb[pjIdx]!, ctx);
      if (!parsed) continue;
      const link = unmatchedLinks[m];
      if (!link) {
        console.warn(`  ${ctx} nema linkanu banku za fallback — preskačem (novo pitanje?)`);
        r.noMatch++;
        continue;
      }
      updates.push({ bankaId: link.bankaId, parsed, via: "link", ctx });
      r.matchByLink++;
    }

    // Izvrši UPDATE-e
    for (const u of updates) {
      // Provjera konflikta: ako novi text postoji u banci sa drugim id-em
      // (samo za standardne tipove — interaktivni se dedup-uju po (text, vrsta, meta)).
      if (u.parsed.vrsta !== "dragDrop" && u.parsed.vrsta !== "markWords") {
        const conflict = await db
          .select({ id: pitanjaBankaTable.id })
          .from(pitanjaBankaTable)
          .where(
            and(
              eq(pitanjaBankaTable.pitanje, u.parsed.pitanje),
              ne(pitanjaBankaTable.id, u.bankaId),
              sql`vrsta NOT IN ('dragDrop','markWords')`,
            ),
          )
          .limit(1);
        if (conflict.length > 0 && !linkedIds.has(conflict[0]!.id)) {
          console.warn(`  ${u.ctx} KONFLIKT: novi tekst već postoji u banci kao id=${conflict[0]!.id} — preskačem`);
          r.conflicts++;
          const before = allBank.find((b) => b.id === u.bankaId);
          r.conflictDetails.push({
            ctx: u.ctx,
            kvizId: k.id,
            kvizSlug: k.slug,
            kvizNaslov: k.naslov,
            pjIdx: pitanjaJsonb.findIndex((pp) => normalize(pp.question ?? "") === u.parsed.pitanje),
            targetBankaId: u.bankaId,
            targetBankaText: before?.pitanje ?? "",
            newText: u.parsed.pitanje,
            conflictBankaId: conflict[0]!.id,
            reason: "duplicate_text",
          });
          continue;
        }
      }

      // Da li je išta promijenjeno?
      const before = allBank.find((b) => b.id === u.bankaId);
      const same =
        before &&
        normalize(before.pitanje) === u.parsed.pitanje &&
        JSON.stringify(before.opcije) === JSON.stringify(u.parsed.opcije) &&
        before.correctIndex === u.parsed.correctIndex &&
        JSON.stringify(before.correctIndexes) === JSON.stringify(u.parsed.correctIndexes) &&
        JSON.stringify(before.correctOrder) === JSON.stringify(u.parsed.correctOrder) &&
        JSON.stringify(before.meta) === JSON.stringify(u.parsed.meta) &&
        (before.objasnjenje ?? "") === u.parsed.objasnjenje &&
        (before.slika ?? null) === u.parsed.slika &&
        before.vrsta === u.parsed.vrsta;
      if (same) {
        r.unchanged++;
        continue;
      }

      if (dryRun) {
        console.log(`  ${u.ctx} WOULD UPDATE banka.id=${u.bankaId} via=${u.via}`);
        r.updated++;
        continue;
      }

      try {
        await db
          .update(pitanjaBankaTable)
          .set({
            pitanje: u.parsed.pitanje,
            opcije: u.parsed.opcije,
            correctIndex: u.parsed.correctIndex,
            correctIndexes: u.parsed.correctIndexes,
            correctOrder: u.parsed.correctOrder,
            meta: u.parsed.meta,
            objasnjenje: u.parsed.objasnjenje,
            slika: u.parsed.slika,
            vrsta: u.parsed.vrsta,
            updatedAt: new Date(),
          })
          .where(eq(pitanjaBankaTable.id, u.bankaId));
        r.updated++;
      } catch (err: any) {
        console.warn(`  ${u.ctx} UPDATE failed: ${err?.message || err}`);
        r.conflicts++;
        const before2 = allBank.find((b) => b.id === u.bankaId);
        r.conflictDetails.push({
          ctx: u.ctx,
          kvizId: k.id,
          kvizSlug: k.slug,
          kvizNaslov: k.naslov,
          pjIdx: pitanjaJsonb.findIndex((pp) => normalize(pp.question ?? "") === u.parsed.pitanje),
          targetBankaId: u.bankaId,
          targetBankaText: before2?.pitanje ?? "",
          newText: u.parsed.pitanje,
          reason: "db_error",
          error: String(err?.message || err),
        });
      }
    }
  }

  log("\n[sync] gotovo!");
  log(`  Kvizova obrađeno:       ${r.kvizovaObradjeno}`);
  log(`  Pitanja u JSONB-u:      ${r.pitanjaUkupno}`);
  log(`  Match po tekstu:        ${r.matchByText}`);
  log(`  Match po linku (fallback): ${r.matchByLink}`);
  log(`  Nema match-a (novo?):   ${r.noMatch}`);
  log(`  Updated:                ${r.updated}`);
  log(`  Unchanged:              ${r.unchanged}`);
  log(`  Skipped (parse fail):   ${r.skipped}`);
  log(`  Conflicts:              ${r.conflicts}`);
  if (dryRun) log("\n  DRY-RUN — ništa nije pisano.");
  return r;
}

const isCli =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1]?.includes("sync-kvizovi-jsonb-u-banku");
if (isCli) {
  const dryRun = process.argv.includes("--dry-run");
  syncKvizoviUBanku({ dryRun })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[sync] GREŠKA:", err);
      process.exit(1);
    });
}
