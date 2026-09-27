/**
 * Replace retained Bosnian Arabic transliteration in EN/DE lesson HTML with
 * the verified, language-specific forms already used by the translation tool.
 *
 * Usage: pnpm --filter @workspace/scripts exec tsx src/repair-transliteration-overlays.ts
 *        pnpm --filter @workspace/scripts exec tsx src/repair-transliteration-overlays.ts --apply
 * Requires PROD_DATABASE_URL. Dry-run by default; backups are written to /tmp
 * before the guarded transaction when applying.
 */
import { writeFileSync } from "node:fs";
import pg from "pg";
import { CJELINE } from "./transkripcija-podaci.js";
import { njemackiIzEngleskog, primijeniEulogije } from "./transkripcija.js";

type Lang = "en" | "de";
type Row = {
  id: number;
  tabela: string;
  red_id: number;
  jezik: Lang;
  polje: string;
  prijevod: string;
};

const connectionString = process.env.PROD_DATABASE_URL;
if (!connectionString) throw new Error("PROD_DATABASE_URL is required");
const apply = process.argv.includes("--apply");
const pool = new pg.Pool({ connectionString });

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const lines = CJELINE.flatMap((c) => c.redovi).flatMap((line) => {
  const variants = [line.bs];
  if (line.bs.startsWith("Euzu billahi")) variants.push(line.bs.replace(/^Euzu/, "E'uzu"));
  return variants.map((bs) => ({
    bs,
    en: line.en,
    de: njemackiIzEngleskog(line.en),
    pattern: new RegExp(`(?<!\\p{L})${escapeRegex(bs)}(?!\\p{L})`, "giu"),
  }));
}).concat([
  // Short quotations and surah names often appear inside sentences rather
  // than as a complete verse, and cannot match the full-line dictionary.
  { bs: "E'uzu billahi", en: "A'udhu billahi", de: "A'udhu billahi" },
  { bs: "Euzu billahi", en: "A'udhu billahi", de: "A'udhu billahi" },
  { bs: "Iza dža'e", en: "Idha ja'a", de: "Idha dscha'a" },
  { bs: "Iza džae", en: "Idha ja'a", de: "Idha dscha'a" },
  { bs: "Allahumme salli", en: "Allahumma salli", de: "Allahumma salli" },
].map((line) => ({
  ...line,
  pattern: new RegExp(`(?<!\\p{L})${escapeRegex(line.bs)}(?!\\p{L})`, "giu"),
}))).sort((a, b) => b.bs.length - a.bs.length);

// Keep tags, attributes, media URLs, interactive blocks, and their whitespace
// byte-for-byte. A quoted `>` in an HTML attribute must not end a tag.
const htmlTag = /(<(?:"[^"]*"|'[^']*'|[^'">])*>)/g;

function convertHtml(html: string, lang: Lang): { value: string; matches: string[] } {
  const matches: string[] = [];
  const parts = html.split(htmlTag).map((part) => {
    if (part.startsWith("<") && part.endsWith(">")) return part;
    let text = part;
    for (const line of lines) {
      text = text.replace(line.pattern, (matched) => {
        matches.push(line.bs);
        const translated = line[lang];
        return matched === matched.toUpperCase() ? translated.toUpperCase() : translated;
      });
    }
    const withEulogies = primijeniEulogije(text, lang);
    if (withEulogies !== text) matches.push("vjerska počast (dž.š./a.s./s.a.v.s./r.a.)");
    text = withEulogies;
    return text;
  });
  return { value: parts.join(""), matches };
}

try {
  const result = await pool.query<Row>(
    "SELECT id, tabela, red_id, jezik, polje, prijevod FROM content_prijevodi WHERE jezik IN ('en','de') AND polje = 'content_html'",
  );
  const changed = result.rows.flatMap((row) => {
    const converted = convertHtml(row.prijevod, row.jezik);
    if (JSON.stringify(row.prijevod.match(htmlTag)) !== JSON.stringify(converted.value.match(htmlTag))) {
      throw new Error(`HTML tag structure changed for translation ${row.id}`);
    }
    return converted.value === row.prijevod ? [] : [{ row, ...converted }];
  });
  console.log(`Provjereno: ${result.rows.length} EN/DE HTML prijevoda; transkripcije za ispravku: ${changed.length} zapisa.`);
  for (const { row, matches } of changed) {
    console.log(`${row.tabela}/${row.red_id} ${row.jezik}: ${matches.length} izraza (${[...new Set(matches)].slice(0, 3).join("; ")})`);
  }
  if (process.argv.includes("--sample")) {
    for (const { row, value } of changed.slice(0, 8)) {
      let offset = 0;
      while (row.prijevod[offset] === value[offset] && offset < row.prijevod.length) offset++;
      console.log(`PRIMJER ${row.id}: ${JSON.stringify(row.prijevod.slice(Math.max(0, offset - 28), offset + 80))} → ${JSON.stringify(value.slice(Math.max(0, offset - 28), offset + 105))}`);
    }
  }
  if (apply && changed.length) {
    const backupPath = `/tmp/transkripcija-overlays-backup-${Date.now()}.jsonl`;
    writeFileSync(backupPath, changed.map(({ row }) => JSON.stringify(row)).join("\n") + "\n");
    console.log(`Rezervna kopija: ${backupPath}`);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const { row, value } of changed) {
        const saved = await client.query(
          "UPDATE content_prijevodi SET prijevod = $1, updated_at = now() WHERE id = $2 AND prijevod = $3 RETURNING id",
          [value, row.id, row.prijevod],
        );
        if (saved.rowCount !== 1) throw new Error(`Red ${row.id} se promijenio tokom obrade; vraćanje transakcije`);
      }
      await client.query("COMMIT");
      console.log(`Uspješno ispravljeno ${changed.length} zapisa.`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}