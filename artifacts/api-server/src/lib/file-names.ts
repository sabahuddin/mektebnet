import path from "path";

const MOJIBAKE_MARKERS = /(?:Ã.|Å.|Ä.)/;

/**
 * Browsers šalju UTF-8 naziv, ali Busboy/Multer ga u nekim verzijama protumači
 * kao latin1 (npr. "š" postane "Å¡"). Popravi samo prepoznatljiv mojibake kako
 * se već ispravan Unicode naziv ne bi pokvario.
 */
export function normalizeUploadedFilename(filename: string): string {
  if (!MOJIBAKE_MARKERS.test(filename)) return filename;
  const repaired = Buffer.from(filename, "latin1").toString("utf8");
  return repaired.includes("\uFFFD") ? filename : repaired;
}

function cleanOriginalFilename(filename: string, fallback: string): string {
  const normalized = normalizeUploadedFilename(filename);
  const basename = path.basename(normalized.replace(/\\/g, "/"))
    .replace(/[\r\n]/g, " ")
    .trim();
  return basename || fallback;
}

export function asciiFilename(filename: string, fallback = "download"): string {
  const original = cleanOriginalFilename(filename, fallback);
  const ascii = original
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[\\/"';]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return ascii && !/^\.+$/.test(ascii) ? ascii : fallback;
}

function encodeRfc5987(filename: string): string {
  return encodeURIComponent(filename).replace(
    /['()*]/g,
    char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function contentDisposition(
  filename: string,
  disposition: "inline" | "attachment" = "attachment",
): string {
  const original = cleanOriginalFilename(filename, "download");
  return `${disposition}; filename="${asciiFilename(original)}"; filename*=UTF-8''${encodeRfc5987(original)}`;
}