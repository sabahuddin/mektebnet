import sanitizeHtml from "sanitize-html";

const SAFE_STYLE_VALUE = /^(?!.*(?:expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding|behavior\s*:|url\s*\())[\s\S]*$/i;

const SAFE_STYLE_PROPERTIES = [
  "align-items",
  "aspect-ratio",
  "background",
  "background-color",
  "border",
  "border-bottom",
  "border-color",
  "border-left",
  "border-radius",
  "border-right",
  "border-style",
  "border-top",
  "border-width",
  "box-shadow",
  "color",
  "display",
  "flex",
  "flex-direction",
  "flex-wrap",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "gap",
  "height",
  "justify-content",
  "letter-spacing",
  "line-height",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-height",
  "max-width",
  "min-height",
  "min-width",
  "object-fit",
  "overflow",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "text-align",
  "text-decoration",
  "vertical-align",
  "white-space",
  "width",
] as const;

const allowedStyles = Object.fromEntries(
  SAFE_STYLE_PROPERTIES.map((property) => [property, [SAFE_STYLE_VALUE]]),
);

/**
 * Čisti HTML koji muallim snima u Ilmihal lekciju. Admin ostaje odgovoran za
 * sistemski sadržaj; muallim dobija samo ovaj strogo filtrirani put.
 */
export function sanitizeMuallimLessonHtml(
  html: string,
  allowedIframeHostnames: string[],
): string {
  // sanitize-html poredi iframe hostove egzaktno, dok naš postojeći whitelist
  // namjerno dopušta i poddomene. Pošto ruta prije ovoga već odbije svaki
  // nedozvoljeni iframe, sanitizeru proslijedi samo tačne, provjerene hostove
  // koji se stvarno pojavljuju u ovom HTML-u.
  const exactIframeHostnames = new Set<string>();
  for (const match of html.matchAll(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    try {
      const host = new URL(match[1]).hostname.toLowerCase();
      if (allowedIframeHostnames.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
        exactIframeHostnames.add(host);
      }
    } catch {
      // Neispravan URL ionako ne može preživjeti sanitizer.
    }
  }

  return sanitizeHtml(html, {
    allowedTags: [
      "a",
      "audio",
      "b",
      "blockquote",
      "br",
      "caption",
      "code",
      "col",
      "colgroup",
      "dd",
      "del",
      "div",
      "dl",
      "dt",
      "em",
      "figcaption",
      "figure",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "i",
      "iframe",
      "img",
      "li",
      "mark",
      "ol",
      "p",
      "pre",
      "s",
      "small",
      "source",
      "span",
      "strong",
      "sub",
      "sup",
      "table",
      "tbody",
      "td",
      "tfoot",
      "th",
      "thead",
      "tr",
      "u",
      "ul",
    ],
    allowedAttributes: {
      "*": [
        "class",
        "dir",
        "id",
        "lang",
        "style",
        "title",
        "data-align",
        "data-size",
      ],
      a: ["href", "rel", "target"],
      audio: ["class", "controls", "preload", "src"],
      col: ["span", "width"],
      div: [
        "data-align",
        "data-lesson-pause",
        "data-pause-config",
        "data-size",
        "data-title",
        "data-youtube-video",
      ],
      iframe: [
        "allow",
        "allowfullscreen",
        "class",
        "frameborder",
        "height",
        "loading",
        "referrerpolicy",
        "src",
        "title",
        "width",
      ],
      img: ["alt", "class", "height", "loading", "src", "title", "width"],
      ol: ["start", "type"],
      source: ["src", "type"],
      table: ["cellpadding", "cellspacing"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
    },
    allowedIframeHostnames: [...exactIframeHostnames],
    allowedStyles: {
      "*": allowedStyles,
    },
    allowProtocolRelative: false,
    enforceHtmlBoundary: true,
    exclusiveFilter: (frame) => frame.tag === "iframe" && !frame.attribs.src,
    transformTags: {
      a: (_tagName, attribs) => {
        if (attribs.target === "_blank") {
          const rel = new Set((attribs.rel || "").split(/\s+/).filter(Boolean));
          rel.add("noopener");
          rel.add("noreferrer");
          return { tagName: "a", attribs: { ...attribs, rel: [...rel].join(" ") } };
        }
        return { tagName: "a", attribs };
      },
    },
  });
}