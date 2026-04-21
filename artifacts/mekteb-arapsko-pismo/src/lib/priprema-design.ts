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

function keepInlineFormatting(html: string): string {
  // Zadrži <strong>, <em>, <br>, <p> ali uprosti ostalo
  return decodeEntities(
    html
      .replace(/<div[^>]*>/gi, "")
      .replace(/<\/div>/gi, "")
      .replace(/<span[^>]*>/gi, "")
      .replace(/<\/span>/gi, "")
      .trim()
  );
}

function extractAfterStrong(html: string, label: string): string {
  const re = new RegExp(
    `<strong[^>]*>\\s*${label}\\s*:?\\s*<\\/strong>([\\s\\S]*?)(?=<\\/div>)`,
    "i"
  );
  const m = html.match(re);
  return m ? stripTags(m[1]) : "";
}

function extractAfterPill(html: string, label: string): string {
  const re = new RegExp(
    `<span[^>]*>\\s*${label}\\s*<\\/span>([\\s\\S]*?)<\\/div>`,
    "i"
  );
  const m = html.match(re);
  return m ? stripTags(m[1]) : "";
}

function extractStructureDio(html: string, dioName: string): string {
  const re = new RegExp(
    `${dioName}\\s+dio\\s*<\\/div>([\\s\\S]*?)<\\/div>\\s*(?=<div|<\\/div>|$)`,
    "i"
  );
  const m = html.match(re);
  if (!m) return "";
  let inner = m[1].trim();
  inner = inner.replace(/^<p[^>]*>([\s\S]*)<\/p>\s*$/i, "$1");
  inner = inner.replace(/^<div[^>]*>([\s\S]*)<\/div>\s*$/i, "$1");
  return keepInlineFormatting(inner);
}

function extractTableField(html: string, label: string): string {
  const re = new RegExp(
    `<td[^>]*>\\s*${label.replace(/\s+/g, "\\s+")}\\s*<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`,
    "i"
  );
  const m = html.match(re);
  return m ? stripTags(m[1]) : "";
}

function extractGradientField(html: string, label: string): string {
  // New design: <div>Label</div><div>Value</div> inside cards
  const re = new RegExp(
    `<div[^>]*>\\s*${label.replace(/\s+/g, "\\s+")}\\s*<\\/div>\\s*<div[^>]*>([\\s\\S]*?)<\\/div>`,
    "i"
  );
  const m = html.match(re);
  return m ? stripTags(m[1]) : "";
}

function extractCiljField(html: string, emoji: string, label: string): string {
  // New design: gradient cilj cards with emoji + label, then value in next div
  const re = new RegExp(
    `${emoji}\\s*${label.replace(/\s+/g, "\\s+")}[^<]*<\\/div>\\s*<div[^>]*>([\\s\\S]*?)<\\/div>`,
    "i"
  );
  const m = html.match(re);
  return m ? stripTags(m[1]) : "";
}

function extractDioField(html: string, emoji: string, label: string): string {
  // New design: emoji + label header, then value div after
  const re = new RegExp(
    `${emoji}\\s*${label.replace(/\s+/g, "\\s+")}[^<]*<\\/div>\\s*<div[^>]*>([\\s\\S]*?)<\\/div>`,
    "i"
  );
  const m = html.match(re);
  if (!m) return "";
  return keepInlineFormatting(m[1]);
}

/**
 * Parse priprema content (the innerHTML of `<div id="priprema" class="lesson-content">`)
 * into structured fields. Handles both old `lesson-intro` design and new inline-styled design.
 */
export function parsePripremaContent(contentHtml: string): PripremaStruct | null {
  if (!contentHtml || contentHtml.trim().length < 20) return null;

  // Try NEW inline-styled design first (has "Nastavna jedinica" as <div> label)
  if (/Nastavna\s+jedinica\s*<\/div>/i.test(contentHtml) || /📋\s*Priprema za nastavu/i.test(contentHtml)) {
    return {
      predmet: extractGradientField(contentHtml, "Predmet") || "Ahlak",
      nastavnaJedinica: extractGradientField(contentHtml, "Nastavna jedinica"),
      tipSata: extractGradientField(contentHtml, "Tip sata"),
      odgojni: extractCiljField(contentHtml, "❤️", "Odgojni cilj"),
      obrazovni: extractCiljField(contentHtml, "📚", "Obrazovni cilj"),
      funkcionalni: extractCiljField(contentHtml, "💪", "Funkcionalni cilj"),
      obliciRada: extractAfterPill(contentHtml, "Oblici rada") || "Frontalni, individualni",
      sredstva: extractAfterPill(contentHtml, "Sredstva") || "Udžbenik, tabla, kreda",
      metode: extractAfterPill(contentHtml, "Metode") || "Metoda usmenog izlaganja, demonstrativna metoda, razgovor",
      uvodniDio: extractDioField(contentHtml, "🔵", "Uvodni dio"),
      glavniDio: extractDioField(contentHtml, "🟢", "Glavni dio"),
      zavrsniDio: extractDioField(contentHtml, "🟡", "Završni dio"),
    };
  }

  // OLD design (lesson-intro + tables)
  if (/lesson-intro/i.test(contentHtml) || /Tip nastavnog sata/i.test(contentHtml)) {
    return {
      predmet: extractTableField(contentHtml, "Predmet") || "Ahlak",
      nastavnaJedinica: extractTableField(contentHtml, "Nastavna jedinica"),
      tipSata: extractTableField(contentHtml, "Tip nastavnog sata"),
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

  return null;
}

function esc(s: string): string {
  return (s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Render priprema struct as rich inline-styled HTML.
 * Returns the INNER HTML of `<div id="priprema" class="lesson-content">` (starts with <div class="lesson-text">).
 * The outer accordion wrapper is added by reassembleHtml.
 */
export function renderPripremaContent(s: PripremaStruct): string {
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

    </div>`;
}
