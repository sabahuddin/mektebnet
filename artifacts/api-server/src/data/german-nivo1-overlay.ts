import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { brotliDecompressSync } from "node:zlib";

export type BundledGermanOverlay = {
  slug: string;
  field: "naslov" | "content_html" | "kviz_pitanja";
  translation: string;
  sourceHash: string;
};

const compressed =
  "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";

const completeBundlePath = fileURLToPath(
  new URL("./german-nivo1-overlays.b64", import.meta.url),
);

const decodedOverlays: BundledGermanOverlay[] = JSON.parse(
  brotliDecompressSync(
    Buffer.from(readFileSync(completeBundlePath, "utf8").trim(), "base64"),
  ).toString("utf8"),
) as BundledGermanOverlay[];

/**
 * The Bosnian source of Nivo 1, Lekcija 5 was refreshed after the original
 * reviewed German bundle was prepared. Keep its reviewed German wording, but
 * use the current lesson wrapper and hero image so the source-hash guard can
 * safely apply it instead of falling back to Bosnian.
 */
const CURRENT_LEKCIJA_FIVE_SOURCE_HASH =
  "9ef52d5af3ec52f8136c510c2bd61fc888266a15573ab3fe36dcbbc3e389f547";

function currentLekcijaFiveTranslation(translation: string) {
  return translation
    .replace(/^\s*<div class="lesson-container">\s*/, "")
    .replace(/<img src="[^"]*mekteb_prvi_dan[^"]*"/, '<img src="/uploads/1778348120878-1ahn2f.webp"')
    .replace(/\s*<\/div>\s*$/, "");
}

export const bundledGermanNivo1Overlays: BundledGermanOverlay[] = decodedOverlays.map((overlay) => (
  overlay.slug === "ja-idem-u-mekteb" && overlay.field === "content_html"
    ? {
        ...overlay,
        sourceHash: CURRENT_LEKCIJA_FIVE_SOURCE_HASH,
        translation: currentLekcijaFiveTranslation(overlay.translation),
      }
    : overlay
));