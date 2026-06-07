import path from "path";
import fs from "fs";
import type { Response } from "express";

// Mekteb dokumenti (PDF: pravila, kućni red...) NISU javni — vidljivi su samo
// članovima mekteba (glavni muallim, učenici, roditelji povezanog djeteta).
// Zato ih čuvamo u zasebnom poddirektoriju koji je BLOKIRAN za direktni static
// pristup (vidi app.ts) i serviramo isključivo kroz autorizovane API rute koje
// provjeravaju role + pripadnost mektebu.
const uploadsBase = process.env["UPLOADS_DIR"]
  ? path.resolve(process.env["UPLOADS_DIR"])
  : path.resolve(process.cwd(), "uploads");

// Segment koji app.ts koristi za blokadu direktnog static pristupa.
export const MEKTEB_DOKUMENTI_SEGMENT = "mekteb-dokumenti";
export const mektebDokumentiDir = path.join(uploadsBase, MEKTEB_DOKUMENTI_SEGMENT);

if (!fs.existsSync(mektebDokumentiDir)) {
  fs.mkdirSync(mektebDokumentiDir, { recursive: true });
}

export interface DokumentFajl {
  storedName: string;
  originalName: string;
  mimeType: string | null;
}

// Stream-a PDF inline uz originalno ime. Pretpostavlja da je pozivalac VEĆ
// provjerio autorizaciju (role + mektebId).
export function streamDokument(res: Response, doc: DokumentFajl) {
  const safe = path.basename(doc.storedName);
  const fp = path.join(mektebDokumentiDir, safe);
  if (!fp.startsWith(mektebDokumentiDir) || !fs.existsSync(fp)) {
    res.status(404).json({ error: "Fajl nije pronađen" });
    return;
  }
  res.setHeader("Content-Type", doc.mimeType || "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.originalName)}"`);
  fs.createReadStream(fp).pipe(res);
}

export function deleteDokumentFajl(storedName: string) {
  try {
    const fp = path.join(mektebDokumentiDir, path.basename(storedName));
    if (fp.startsWith(mektebDokumentiDir) && fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch {
    // best-effort: ako fajl već ne postoji, nastavi
  }
}
