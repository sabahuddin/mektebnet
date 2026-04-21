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

function textOf(el: Element | null | undefined): string {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

/** Parse new inline-styled gradient design via DOM. */
function parseNewDesign(contentHtml: string): PripremaStruct | null {
  const doc = new DOMParser().parseFromString(`<div>${contentHtml}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return null;

  const result: PripremaStruct = {
    predmet: "Ahlak",
    nastavnaJedinica: "",
    tipSata: "",
    odgojni: "",
    obrazovni: "",
    funkcionalni: "",
    obliciRada: "",
    sredstva: "",
    metode: "",
    uvodniDio: "",
    glavniDio: "",
    zavrsniDio: "",
  };

  // 1) Walk all divs and look for label/value pairs
  const divs = Array.from(root.querySelectorAll("div"));
  for (const d of divs) {
    const t = textOf(d);
    // Hero teal block: each label ("Nastavna jedinica", "Predmet", "Tip sata") sits
    // in a small <div> immediately followed by a value <div>
    if (t === "Nastavna jedinica") {
      result.nastavnaJedinica = textOf(d.nextElementSibling);
    } else if (t === "Predmet") {
      const v = textOf(d.nextElementSibling);
      if (v) result.predmet = v;
    } else if (t === "Tip sata") {
      result.tipSata = textOf(d.nextElementSibling);
    } else if (/^❤️\s*Odgojni\s+cilj/i.test(t)) {
      result.odgojni = textOf(d.nextElementSibling);
    } else if (/^📚\s*Obrazovni\s+cilj/i.test(t)) {
      result.obrazovni = textOf(d.nextElementSibling);
    } else if (/^(💪|⚙️)\s*Funkcionalni\s+cilj/i.test(t)) {
      result.funkcionalni = textOf(d.nextElementSibling);
    } else if (/^🔵\s*Uvodni\s+dio/i.test(t)) {
      result.uvodniDio = innerHtmlOfNext(d);
    } else if (/^🟢\s*Glavni\s+dio/i.test(t)) {
      result.glavniDio = innerHtmlOfNext(d);
    } else if (/^🟡\s*Završni\s+dio/i.test(t)) {
      result.zavrsniDio = innerHtmlOfNext(d);
    }
  }

  // 2) Pills (Oblici rada / Sredstva / Metode)
  const pillRows = Array.from(root.querySelectorAll("div"));
  for (const d of pillRows) {
    const span = d.querySelector("span");
    if (!span) continue;
    const label = textOf(span);
    // Get the text after the span (sibling text node)
    let after = "";
    let n: Node | null = span.nextSibling;
    while (n) {
      if (n.nodeType === 3) after += n.nodeValue || "";
      else if (n.nodeType === 1) after += (n as Element).textContent || "";
      n = n.nextSibling;
    }
    after = after.replace(/\s+/g, " ").trim();
    if (!after) continue;
    if (label === "Oblici rada") result.obliciRada = after;
    else if (label === "Sredstva") result.sredstva = after;
    else if (label === "Metode") result.metode = after;
  }

  return result;
}

/** Get inner HTML of next element sibling, OR full sibling chain text if it's <p>. */
function innerHtmlOfNext(headerDiv: Element): string {
  const next = headerDiv.nextElementSibling;
  if (!next) return "";
  // Could be <p>...</p> or <div>...</div>; we want the inner HTML cleaned of style attrs
  const html = next.innerHTML.trim();
  return decodeEntities(html);
}

/** Parse old "lesson-intro" design using regex (kept as fallback). */
function parseOldDesign(contentHtml: string): PripremaStruct | null {
  function stripTags(html: string): string {
    return decodeEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  }
  function extractAfterStrong(html: string, label: string): string {
    const re = new RegExp(`<strong[^>]*>\\s*${label}\\s*:?\\s*<\\/strong>([\\s\\S]*?)(?=<\\/div>)`, "i");
    const m = html.match(re);
    return m ? stripTags(m[1]) : "";
  }
  function extractAfterPill(html: string, label: string): string {
    const re = new RegExp(`<span[^>]*>\\s*${label}\\s*<\\/span>([\\s\\S]*?)<\\/div>`, "i");
    const m = html.match(re);
    return m ? stripTags(m[1]) : "";
  }
  function extractStructureDio(html: string, dioName: string): string {
    const re = new RegExp(`${dioName}\\s+dio\\s*<\\/div>([\\s\\S]*?)<\\/div>\\s*(?=<div|<\\/div>|$)`, "i");
    const m = html.match(re);
    if (!m) return "";
    let inner = m[1].trim();
    inner = inner.replace(/^<p[^>]*>([\s\S]*)<\/p>\s*$/i, "$1");
    inner = inner.replace(/^<div[^>]*>([\s\S]*)<\/div>\s*$/i, "$1");
    return decodeEntities(inner);
  }
  function extractTableField(html: string, label: string): string {
    const re = new RegExp(
      `<td[^>]*>\\s*${label.replace(/\s+/g, "\\s+")}\\s*<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`,
      "i",
    );
    const m = html.match(re);
    return m ? stripTags(m[1]) : "";
  }

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

export function parsePripremaContent(contentHtml: string): PripremaStruct | null {
  if (!contentHtml || contentHtml.trim().length < 20) return null;

  if (/📋\s*Priprema za nastavu/i.test(contentHtml) || /Nastavna\s+jedinica\s*<\/div>/i.test(contentHtml)) {
    const r = parseNewDesign(contentHtml);
    if (r && (r.uvodniDio || r.glavniDio || r.zavrsniDio || r.nastavnaJedinica)) return r;
  }

  if (/lesson-intro/i.test(contentHtml) || /Tip nastavnog sata/i.test(contentHtml)) {
    return parseOldDesign(contentHtml);
  }

  // Last resort — try new design parser anyway (returns empty struct rather than null)
  return parseNewDesign(contentHtml);
}

function esc(s: string): string {
  return (s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Wrap a dio value: if it already contains block tags (<p>, <div>, <ul>) keep as-is, else wrap in <p>. */
function wrapDio(v: string): string {
  const trimmed = (v || "").trim();
  if (!trimmed) return '<p style="margin: 0; line-height: 1.6; color: #1f2937;"></p>';
  if (/<(p|div|ul|ol|h[1-6])\b/i.test(trimmed)) {
    return `<div style="line-height: 1.6; color: #1f2937;">${trimmed}</div>`;
  }
  return `<p style="margin: 0; line-height: 1.6; color: #1f2937;">${trimmed}</p>`;
}

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
