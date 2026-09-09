import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBosnianDashes } from "./normalize-json.js";

test("čuva Date objekte za ispravnu JSON serijalizaciju", () => {
  const createdAt = new Date("2026-09-09T08:30:00.000Z");
  const result = normalizeBosnianDashes({
    createdAt,
    nested: { lastLoginAt: createdAt },
  });

  assert.equal(result.createdAt, createdAt);
  assert.equal(result.nested.lastLoginAt, createdAt);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    createdAt: "2026-09-09T08:30:00.000Z",
    nested: { lastLoginAt: "2026-09-09T08:30:00.000Z" },
  });
});

test("i dalje normalizuje duge crtice u običnom JSON sadržaju", () => {
  assert.deepEqual(
    normalizeBosnianDashes({ naslov: "Prije — poslije", stavke: ["A — B"] }),
    { naslov: "Prije – poslije", stavke: ["A – B"] },
  );
});