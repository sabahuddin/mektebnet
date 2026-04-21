import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

interface PripremaStruct {
  predmet: string;
  nastavnaJedinica: string;
  tipSata: string;
  odgojni: string;
  obrazovni: string;
  funkcionalni: string;
  obliciRada: string;
  sredstva: string;
  metode: string;
  uvodniDio: string;
  glavniDio: string;
  zavrsniDio: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractAfterStrong(html: string, label: string): string {
  // Match <strong ...>Label:</strong> ... [end of div]
  const re = new RegExp(
    `<strong[^>]*>\\s*${label}\\s*:?\\s*<\\/strong>([\\s\\S]*?)(?=<\\/div>)`,
    "i",
  );
  const m = html.match(re);
  return m ? stripTags(m[1]) : "";
}

function extractAfterPill(html: string, label: string): string {
  // Match <span ...>Label</span> ... [end of div]
  const re = new RegExp(
    `<span[^>]*>\\s*${label}\\s*<\\/span>([\\s\\S]*?)<\\/div>`,
    "i",
  );
  const m = html.match(re);
  return m ? stripTags(m[1]) : "";
}

function extractStructureDio(html: string, dioName: string): string {
  // Match the "X dio" header div, then capture the inner HTML of the next sibling content
  // (either <p> or <div>) until the parent block's </div>.
  const re = new RegExp(
    `${dioName}\\s+dio\\s*<\\/div>([\\s\\S]*?)<\\/div>\\s*(?=<div|<\\/div>|$)`,
    "i",
  );
  const m = html.match(re);
  if (!m) return "";
  // Keep inner HTML (preserve <p>, <strong>, <br>) but strip outer wrapping <p>/<div>
  let inner = m[1].trim();
  // Remove outer single <p>...</p> wrapper if present (preserve content)
  inner = inner.replace(/^<p[^>]*>([\s\S]*)<\/p>\s*$/i, "$1");
  inner = inner.replace(/^<div[^>]*>([\s\S]*)<\/div>\s*$/i, "$1");
  return inner.trim();
}

function extractTableField(html: string, label: string): string {
  // Match <td ...>Label</td><td ...>VALUE</td>
  const re = new RegExp(
    `<td[^>]*>\\s*${label.replace(/\s+/g, "\\s+")}\\s*<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`,
    "i",
  );
  const m = html.match(re);
  return m ? stripTags(m[1]) : "";
}

export function parseOldPriprema(pripremaHtml: string): PripremaStruct | null {
  // Sanity check: must contain old design markers
  if (!/lesson-intro/i.test(pripremaHtml) || !/Tip nastavnog sata/i.test(pripremaHtml)) {
    return null;
  }

  return {
    predmet: extractTableField(pripremaHtml, "Predmet"),
    nastavnaJedinica: extractTableField(pripremaHtml, "Nastavna jedinica"),
    tipSata: extractTableField(pripremaHtml, "Tip nastavnog sata"),
    odgojni: extractAfterStrong(pripremaHtml, "Odgojni"),
    obrazovni: extractAfterStrong(pripremaHtml, "Obrazovni"),
    funkcionalni: extractAfterStrong(pripremaHtml, "Funkcionalni"),
    obliciRada: extractAfterPill(pripremaHtml, "Oblici rada") || "Frontalni, individualni",
    sredstva: extractAfterPill(pripremaHtml, "Sredstva") || "Udžbenik, tabla, kreda",
    metode:
      extractAfterPill(pripremaHtml, "Metode") ||
      "Metoda usmenog izlaganja, demonstrativna metoda, razgovor",
    uvodniDio: extractStructureDio(pripremaHtml, "Uvodni"),
    glavniDio: extractStructureDio(pripremaHtml, "Glavni"),
    zavrsniDio: extractStructureDio(pripremaHtml, "Završni"),
  };
}

export function renderNewPriprema(s: PripremaStruct): string {
  const predmetShort = s.predmet.replace(/Vjeronauka\s*[–-]\s*Ilmihal\s*\([^)]*\)/i, "Ahlak").trim() || "Ahlak";
  return `<!--PRIPREMA-START--><div class="lesson-accordion">
  <button class="lesson-section-btn" onclick="toggleSection('priprema', this)">
    PRIPREMA ZA NASTAVU <span class="section-icon">▼</span>
  </button>
  <div id="priprema" class="lesson-content" style="display: none;">
    <div class="lesson-text">

      <div style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: #ffffff; padding: 22px 24px; border-radius: 14px; margin-bottom: 22px; box-shadow: 0 6px 18px rgba(20,184,166,0.25);">
        <div style="font-size: 1.35rem; font-weight: 800; margin-bottom: 14px; display: flex; align-items: center; gap: 10px;">📋 Priprema za nastavu</div>
        <div style="background: rgba(255,255,255,0.18); padding: 12px 16px; border-radius: 10px; margin-bottom: 12px;">
          <div style="font-size: 0.8rem; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700;">Nastavna jedinica</div>
          <div style="font-size: 1.15rem; font-weight: 700; margin-top: 4px;">${s.nastavnaJedinica}</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px;">
          <div style="background: rgba(255,255,255,0.18); padding: 10px 14px; border-radius: 10px;">
            <div style="font-size: 0.78rem; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">Predmet</div>
            <div style="font-weight: 700; font-size: 1.05rem; margin-top: 3px;">${predmetShort}</div>
          </div>
          <div style="background: rgba(255,255,255,0.18); padding: 10px 14px; border-radius: 10px;">
            <div style="font-size: 0.78rem; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">Tip sata</div>
            <div style="font-weight: 700; font-size: 1.05rem; margin-top: 3px;">${s.tipSata}</div>
          </div>
        </div>
      </div>

      <h3 style="margin: 22px 0 14px 0; color: #0f766e; font-size: 1.2rem; display: flex; align-items: center; gap: 8px;">🎯 Ciljevi nastavnog sata</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 22px;">
        <div style="background: #fef2f2; border-top: 4px solid #ef4444; padding: 14px 16px; border-radius: 10px;">
          <div style="font-weight: 800; color: #b91c1c; margin-bottom: 6px; font-size: 0.95rem;">❤️ Odgojni cilj</div>
          <div style="color: #1f2937; line-height: 1.5;">${s.odgojni}</div>
        </div>
        <div style="background: #eff6ff; border-top: 4px solid #3b82f6; padding: 14px 16px; border-radius: 10px;">
          <div style="font-weight: 800; color: #1d4ed8; margin-bottom: 6px; font-size: 0.95rem;">📚 Obrazovni cilj</div>
          <div style="color: #1f2937; line-height: 1.5;">${s.obrazovni}</div>
        </div>
        <div style="background: #f0fdf4; border-top: 4px solid #22c55e; padding: 14px 16px; border-radius: 10px;">
          <div style="font-weight: 800; color: #15803d; margin-bottom: 6px; font-size: 0.95rem;">💪 Funkcionalni cilj</div>
          <div style="color: #1f2937; line-height: 1.5;">${s.funkcionalni}</div>
        </div>
      </div>

      <h3 style="margin: 22px 0 14px 0; color: #0f766e; font-size: 1.2rem; display: flex; align-items: center; gap: 8px;">🗂️ Organizacija nastave</h3>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 18px; border-radius: 10px; margin-bottom: 22px;">
        <div style="margin-bottom: 10px;"><span style="display: inline-block; background: #e0f2fe; color: #075985; padding: 3px 10px; border-radius: 999px; font-size: 0.85rem; font-weight: 700; margin-right: 8px;">Oblici rada</span> ${s.obliciRada}</div>
        <div style="margin-bottom: 10px;"><span style="display: inline-block; background: #ecfdf5; color: #065f46; padding: 3px 10px; border-radius: 999px; font-size: 0.85rem; font-weight: 700; margin-right: 8px;">Sredstva</span> ${s.sredstva}</div>
        <div><span style="display: inline-block; background: #fef3c7; color: #92400e; padding: 3px 10px; border-radius: 999px; font-size: 0.85rem; font-weight: 700; margin-right: 8px;">Metode</span> ${s.metode}</div>
      </div>

      <h3 style="margin: 22px 0 14px 0; color: #0f766e; font-size: 1.2rem; display: flex; align-items: center; gap: 8px;">📖 Struktura sata</h3>

      <div style="background: #eff6ff; border-left: 5px solid #3b82f6; padding: 14px 18px; border-radius: 0 12px 12px 0; margin-bottom: 14px;">
        <div style="font-weight: 800; color: #1d4ed8; font-size: 1.05rem; margin-bottom: 8px;">🔵 Uvodni dio</div>
        <div style="margin: 0; line-height: 1.6; color: #1f2937;">${s.uvodniDio}</div>
      </div>

      <div style="background: #f0fdf4; border-left: 5px solid #22c55e; padding: 14px 18px; border-radius: 0 12px 12px 0; margin-bottom: 14px;">
        <div style="font-weight: 800; color: #15803d; font-size: 1.05rem; margin-bottom: 8px;">🟢 Glavni dio</div>
        <div style="line-height: 1.6; color: #1f2937;">${s.glavniDio}</div>
      </div>

      <div style="background: #fefce8; border-left: 5px solid #eab308; padding: 14px 18px; border-radius: 0 12px 12px 0;">
        <div style="font-weight: 800; color: #a16207; font-size: 1.05rem; margin-bottom: 8px;">🟡 Završni dio</div>
        <div style="margin: 0; line-height: 1.6; color: #1f2937;">${s.zavrsniDio}</div>
      </div>

    </div>
  </div>
</div><!--PRIPREMA-END-->`;
}

export interface RegenerateReport {
  scanned: number;
  regenerated: string[];
  skippedLocked: string[];
  skippedNoOldDesign: string[];
  failedParse: { slug: string; missing: string[] }[];
  dryRun: boolean;
}

export async function regenerateOldDesignToNew(opts: {
  nivo?: number;
  dryRun?: boolean;
}): Promise<RegenerateReport> {
  const nivo = opts.nivo ?? 1;
  const dryRun = !!opts.dryRun;
  const report: RegenerateReport = {
    scanned: 0,
    regenerated: [],
    skippedLocked: [],
    skippedNoOldDesign: [],
    failedParse: [],
    dryRun,
  };

  const rows = (await db.execute(sql`
    SELECT id, slug, locked, content_html
    FROM ilmihal_lekcije
    WHERE nivo = ${nivo}
      AND content_html LIKE '%PRIPREMA-START%'
  `)) as unknown as {
    rows: { id: number; slug: string; locked: boolean; content_html: string }[];
  };

  for (const row of rows.rows) {
    report.scanned++;
    if (row.locked) {
      report.skippedLocked.push(row.slug);
      continue;
    }
    const m = row.content_html.match(/<!--PRIPREMA-START-->([\s\S]*?)<!--PRIPREMA-END-->/);
    if (!m) {
      report.skippedNoOldDesign.push(row.slug);
      continue;
    }
    const oldPripremaBlock = m[1];
    if (!/lesson-intro/i.test(oldPripremaBlock) || !/Tip nastavnog sata/i.test(oldPripremaBlock)) {
      report.skippedNoOldDesign.push(row.slug);
      continue;
    }
    const struct = parseOldPriprema(oldPripremaBlock);
    if (!struct) {
      report.skippedNoOldDesign.push(row.slug);
      continue;
    }
    const missing: string[] = [];
    if (!struct.nastavnaJedinica) missing.push("nastavnaJedinica");
    if (!struct.tipSata) missing.push("tipSata");
    if (!struct.odgojni) missing.push("odgojni");
    if (!struct.obrazovni) missing.push("obrazovni");
    if (!struct.funkcionalni) missing.push("funkcionalni");
    if (missing.length > 0) {
      report.failedParse.push({ slug: row.slug, missing });
      continue;
    }

    const newBlock = renderNewPriprema(struct);
    const newHtml = row.content_html.replace(
      /<!--PRIPREMA-START-->[\s\S]*?<!--PRIPREMA-END-->/,
      newBlock,
    );

    if (!dryRun) {
      await db.execute(sql`
        UPDATE ilmihal_lekcije
        SET content_html = ${newHtml}
        WHERE id = ${row.id} AND locked = false
      `);
    }
    report.regenerated.push(row.slug);
  }

  logger.info(
    { nivo, dryRun, regenerated: report.regenerated.length, failed: report.failedParse.length },
    "Priprema design regenerate completed",
  );
  return report;
}
