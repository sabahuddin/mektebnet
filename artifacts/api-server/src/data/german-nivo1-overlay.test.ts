import { test } from "node:test";
import assert from "node:assert/strict";
import { bundledGermanNivo1Overlays } from "./german-nivo1-overlay.js";

test("Lekcija 5 njemački overlay prati trenutni produkcijski izvor", () => {
  const overlay = bundledGermanNivo1Overlays.find(
    (entry) => entry.slug === "ja-idem-u-mekteb" && entry.field === "content_html",
  );

  assert.ok(overlay);
  assert.equal(
    overlay.sourceHash,
    "9ef52d5af3ec52f8136c510c2bd61fc888266a15573ab3fe36dcbbc3e389f547",
  );
  assert.ok(overlay.translation.startsWith("<h1>ICH GEHE IN DEN MEKTEB</h1>"));
  assert.ok(overlay.translation.includes('src="/uploads/1778348120878-1ahn2f.webp"'));
  assert.ok(overlay.translation.includes("HEUTE IST EIN BESONDERER TAG"));
  assert.doesNotMatch(overlay.translation, /DANAS JE POSEBAN DAN/i);
});