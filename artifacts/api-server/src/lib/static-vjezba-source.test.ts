import assert from "node:assert/strict";
import { test } from "node:test";
import { STATIC_VJEZBE } from "./static-vjezbe.js";
import {
  readBundledStaticVjezba,
  validateStaticVjezbaSource,
} from "./static-vjezba-source.js";

test("svi bundlovani izvori statičkih vježbi prolaze validaciju", async () => {
  for (const key of Object.keys(STATIC_VJEZBE)) {
    const sourceHtml = await readBundledStaticVjezba(key);
    assert.equal(validateStaticVjezbaSource(sourceHtml), null, key);
  }
});

test("editor odbija prazan ili neispravan HTML bez protokola završetka", () => {
  assert.match(validateStaticVjezbaSource("") ?? "", /prazan/i);
  assert.match(
    validateStaticVjezbaSource("<!doctype html><title>Bez protokola</title>") ?? "",
    /protokol/i,
  );
});