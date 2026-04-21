// Server-side priprema regenerator.
// Detects OLD priprema design (table-based) inside a lesson's content_html
// and replaces it with the NEW gradient design — without touching the DB.
// This lets every server (dev, prod) render the new design even if the DB
// still holds legacy WordPress-era HTML.

export interface PripremaStruct {
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

function extractTableField(html: string, label: string): string {
  const re = new RegExp(
    `<td[^>]*>\\s*(?:<p[^>]*>)?\\s*(?:<strong[^>]*>)?\\s*${label.replace(/\s+/g, "\\s+")}\\s*(?:</strong>)?\\s*(?:</p>)?\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`,
    "i",
  );
  const m = html.match(re);
  return m ? stripTags(m[1]) : "";
}

function extractAfterStrong(html: string, label: string): string {
  // Match <p><strong>Label:</strong>...</p> OR <strong>Label:</strong>...
  const re1 = new RegExp(
    `<p[^>]*>\\s*<strong[^>]*>\\s*${label}\\s*:?\\s*</strong>([\\s\\S]*?)</p>`,
    "i",
  );
  const m1 = html.match(re1);
  if (m1) return stripTags(m1[1]);
  const re2 = new RegExp(
    `<strong[^>]*>\\s*${label}\\s*:?\\s*</strong>([\\s\\S]*?)(?=<(?:strong|p|h[1-6]|div|/div)|$)`,
    "i",
  );
  const m2 = html.match(re2);
  return m2 ? stripTags(m2[1]) : "";
}

function extractStructureDio(html: string, dioName: string): string {
  // The "X dio" label may be preceded by an emoji (🔵🟢🟡) and any whitespace.
  // We use \S* to skip optional emoji/markup chars before the dio name.
  // Try formats:
  //   <p><strong>🔵 Uvodni dio</strong></p>...content...<p><strong>🟢 Glavni dio</strong></p>
  //   <h4>🔵 Uvodni dio</h4>...content...<h4>...
  //   ...Uvodni dio</div>...content...
  const patterns = [
    new RegExp(
      `<p[^>]*>\\s*<strong[^>]*>[^<]*?${dioName}\\s+dio\\s*</strong>\\s*</p>([\\s\\S]*?)(?=<p[^>]*>\\s*<strong[^>]*>[^<]*?(?:Uvodni|Glavni|Zavr[šs]ni)\\s+dio|<h[1-6]|$)`,
      "i",
    ),
    new RegExp(
      `<h[1-6][^>]*>[^<]*?${dioName}\\s+dio[^<]*</h[1-6]>([\\s\\S]*?)(?=<h[1-6]|$)`,
      "i",
    ),
    new RegExp(
      `${dioName}\\s+dio\\s*</div>([\\s\\S]*?)</div>\\s*(?=<div|</div>|$)`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      let inner = m[1].trim();
      inner = inner.replace(/^<p[^>]*>([\s\S]*)<\/p>\s*$/i, "$1");
      inner = inner.replace(/^<div[^>]*>([\s\S]*)<\/div>\s*$/i, "$1");
      const text = stripTags(inner);
      if (text) return text;
    }
  }
  return "";
}

function extractAfterPill(html: string, label: string): string {
  const re = new RegExp(
    `(?:<span[^>]*>|<strong[^>]*>)\\s*${label}\\s*(?:</span>|</strong>)([\\s\\S]*?)(?=<(?:span|strong|p|div|h[1-6]|/div)|$)`,
    "i",
  );
  const m = html.match(re);
  return m ? stripTags(m[1]) : "";
}

export function parseOldPriprema(contentHtml: string): PripremaStruct {
  return {
    predmet: extractTableField(contentHtml, "Predmet") || "Ahlak",
    nastavnaJedinica: extractTableField(contentHtml, "Nastavna jedinica"),
    tipSata: extractTableField(contentHtml, "Tip nastavnog sata") || extractTableField(contentHtml, "Tip sata") || "Obrada novog gradiva",
    odgojni: extractAfterStrong(contentHtml, "Odgojni"),
    obrazovni: extractAfterStrong(contentHtml, "Obrazovni"),
    funkcionalni: extractAfterStrong(contentHtml, "Funkcionalni"),
    obliciRada: extractAfterPill(contentHtml, "Oblici rada") || "Frontalni, individualni",
    sredstva: extractAfterPill(contentHtml, "Sredstva") || "Udžbenik, tabla, kreda",
    metode: extractAfterPill(contentHtml, "Metode") || "Metoda usmenog izlaganja, demonstrativna metoda, razgovor",
    uvodniDio: extractStructureDio(contentHtml, "Uvodni"),
    glavniDio: extractStructureDio(contentHtml, "Glavni"),
    zavrsniDio: extractStructureDio(contentHtml, "Završni"),
  };
}

function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function wrapDio(v: string): string {
  const trimmed = (v || "").trim();
  if (!trimmed) return '<p style="margin: 0; line-height: 1.6; color: #1f2937;"></p>';
  if (/<(p|div|ul|ol|h[1-6])\b/i.test(trimmed)) {
    return `<div style="line-height: 1.6; color: #1f2937;">${trimmed}</div>`;
  }
  return `<p style="margin: 0; line-height: 1.6; color: #1f2937;">${esc(trimmed)}</p>`;
}

export function renderNewPriprema(s: PripremaStruct): string {
  const predmetShort = (s.predmet || "Ahlak")
    .replace(/Vjeronauka\s*[–-]\s*Ilmihal\s*\([^)]*\)/i, "Ahlak")
    .trim() || "Ahlak";
  return `<div class="lesson-text">

      <div style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: #ffffff; padding: 22px 24px; border-radius: 14px; margin-bottom: 22px; box-shadow: 0 6px 18px rgba(20,184,166,0.25);">
        <div style="font-size: 1.35rem; font-weight: 800; margin-bottom: 14px; display: flex; align-items: center; gap: 10px;">📋 Priprema za nastavu</div>
        <div style="background: rgba(255,255,255,0.18); padding: 12px 16px; border-radius: 10px; margin-bottom: 12px;">
          <div style="font-size: 0.8rem; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700;">Nastavna jedinica</div>
          <div style="font-size: 1.15rem; font-weight: 700; margin-top: 4px;">${esc(s.nastavnaJedinica)}</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px;">
          <div style="background: rgba(255,255,255,0.18); padding: 10px 14px; border-radius: 10px;">
            <div style="font-size: 0.78rem; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">Predmet</div>
            <div style="font-weight: 700; font-size: 1.05rem; margin-top: 3px;">${esc(predmetShort)}</div>
          </div>
          <div style="background: rgba(255,255,255,0.18); padding: 10px 14px; border-radius: 10px;">
            <div style="font-size: 0.78rem; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">Tip sata</div>
            <div style="font-weight: 700; font-size: 1.05rem; margin-top: 3px;">${esc(s.tipSata)}</div>
          </div>
        </div>
      </div>

      <h3 style="margin: 22px 0 14px 0; color: #0f766e; font-size: 1.2rem; display: flex; align-items: center; gap: 8px;">🎯 Ciljevi nastavnog sata</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 22px;">
        <div style="background: #fef2f2; border-top: 4px solid #ef4444; padding: 14px 16px; border-radius: 10px;">
          <div style="font-weight: 800; color: #b91c1c; margin-bottom: 6px; font-size: 0.95rem;">❤️ Odgojni cilj</div>
          <div style="color: #1f2937; line-height: 1.5;">${esc(s.odgojni)}</div>
        </div>
        <div style="background: #eff6ff; border-top: 4px solid #3b82f6; padding: 14px 16px; border-radius: 10px;">
          <div style="font-weight: 800; color: #1d4ed8; margin-bottom: 6px; font-size: 0.95rem;">📚 Obrazovni cilj</div>
          <div style="color: #1f2937; line-height: 1.5;">${esc(s.obrazovni)}</div>
        </div>
        <div style="background: #f0fdf4; border-top: 4px solid #22c55e; padding: 14px 16px; border-radius: 10px;">
          <div style="font-weight: 800; color: #15803d; margin-bottom: 6px; font-size: 0.95rem;">💪 Funkcionalni cilj</div>
          <div style="color: #1f2937; line-height: 1.5;">${esc(s.funkcionalni)}</div>
        </div>
      </div>

      <h3 style="margin: 22px 0 14px 0; color: #0f766e; font-size: 1.2rem; display: flex; align-items: center; gap: 8px;">🗂️ Organizacija nastave</h3>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 18px; border-radius: 10px; margin-bottom: 22px;">
        <div style="margin-bottom: 10px;"><span style="display: inline-block; background: #e0f2fe; color: #075985; padding: 3px 10px; border-radius: 999px; font-size: 0.85rem; font-weight: 700; margin-right: 8px;">Oblici rada</span> ${esc(s.obliciRada)}</div>
        <div style="margin-bottom: 10px;"><span style="display: inline-block; background: #ecfdf5; color: #065f46; padding: 3px 10px; border-radius: 999px; font-size: 0.85rem; font-weight: 700; margin-right: 8px;">Sredstva</span> ${esc(s.sredstva)}</div>
        <div><span style="display: inline-block; background: #fef3c7; color: #92400e; padding: 3px 10px; border-radius: 999px; font-size: 0.85rem; font-weight: 700; margin-right: 8px;">Metode</span> ${esc(s.metode)}</div>
      </div>

      <h3 style="margin: 22px 0 14px 0; color: #0f766e; font-size: 1.2rem; display: flex; align-items: center; gap: 8px;">📖 Struktura sata</h3>

      <div style="background: #eff6ff; border-left: 5px solid #3b82f6; padding: 14px 18px; border-radius: 0 12px 12px 0; margin-bottom: 14px;">
        <div style="font-weight: 800; color: #1d4ed8; font-size: 1.05rem; margin-bottom: 8px;">🔵 Uvodni dio</div>
        ${wrapDio(s.uvodniDio)}
      </div>

      <div style="background: #f0fdf4; border-left: 5px solid #22c55e; padding: 14px 18px; border-radius: 0 12px 12px 0; margin-bottom: 14px;">
        <div style="font-weight: 800; color: #15803d; font-size: 1.05rem; margin-bottom: 8px;">🟢 Glavni dio</div>
        ${wrapDio(s.glavniDio)}
      </div>

      <div style="background: #fefce8; border-left: 5px solid #eab308; padding: 14px 18px; border-radius: 0 12px 12px 0;">
        <div style="font-weight: 800; color: #a16207; font-size: 1.05rem; margin-bottom: 8px;">🟡 Završni dio</div>
        ${wrapDio(s.zavrsniDio)}
      </div>

    </div>`;
}

/**
 * Detects the priprema accordion in a lesson's full HTML and, if its inner
 * content uses the OLD design (no "📋 Priprema za nastavu" gradient marker),
 * replaces the inner HTML with the NEW gradient design.
 *
 * Returns the (possibly transformed) full HTML.
 */
export function regeneratePripremaInHtml(fullHtml: string): string {
  if (!fullHtml || typeof fullHtml !== "string") return fullHtml;

  // Find the priprema accordion block. The accordion has a button with
  // onclick="toggleSection('priprema', ...)" and a div with id="priprema".
  const re = /<div\s+id="priprema"\s+class="lesson-content"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i;
  const m = fullHtml.match(re);
  if (!m) return fullHtml;

  const innerHtml = m[1];

  // Already new design — leave alone.
  if (innerHtml.includes("📋 Priprema za nastavu") || innerHtml.includes("linear-gradient(135deg, #14b8a6")) {
    return fullHtml;
  }

  // Parse old design and re-render new
  const parsed = parseOldPriprema(innerHtml);
  // Sanity: if we couldn't extract anything meaningful, leave the original alone.
  if (!parsed.nastavnaJedinica && !parsed.odgojni && !parsed.obrazovni && !parsed.uvodniDio && !parsed.glavniDio) {
    return fullHtml;
  }
  const newInner = renderNewPriprema(parsed);

  // Replace just the inner HTML, keep the outer <div id="priprema" class="lesson-content"></div></div>
  const replacement = m[0].replace(innerHtml, "\n" + newInner + "\n");
  return fullHtml.replace(m[0], replacement);
}
