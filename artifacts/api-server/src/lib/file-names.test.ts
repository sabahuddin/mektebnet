import assert from "node:assert/strict";
import test from "node:test";
import {
  asciiFilename,
  contentDisposition,
  normalizeUploadedFilename,
} from "./file-names.js";

test("popravlja Multer mojibake za bosanska slova", () => {
  const correct = "Kućni red džemata šđčćž.pdf";
  const multerMojibake = Buffer.from(correct, "utf8").toString("latin1");
  assert.equal(
    normalizeUploadedFilename(multerMojibake),
    correct,
  );
  assert.equal(
    normalizeUploadedFilename(correct),
    correct,
  );
});

test("pravi čitljiv ASCII fallback bez kvačica", () => {
  assert.equal(
    asciiFilename("Kućni red džemata šđčćž.pdf"),
    "Kucni red dzemata sdccz.pdf",
  );
});

test("Content-Disposition šalje ASCII fallback i UTF-8 original", () => {
  const header = contentDisposition("Kućni red šđčćž.pdf", "inline");
  assert.match(header, /^inline; filename="Kucni red sdccz\.pdf"; /);
  assert.ok(header.includes("filename*=UTF-8''Ku%C4%87ni%20red%20%C5%A1%C4%91%C4%8D%C4%87%C5%BE.pdf"));
  assert.equal(/[\r\n]/.test(header), false);
});