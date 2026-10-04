import assert from "node:assert/strict";
import { test } from "node:test";
import { linkifyText } from "./linkify-text";

test("preserves plain text, whitespace and line breaks", () => {
  for (const text of ["", "Pročitaj lekciju.\n  Ponovi zadatak.", "Nema poveznice"]) {
    const parts = linkifyText(text);
    assert.equal(parts.map((part) => part.text).join(""), text);
    assert.ok(parts.every((part) => !part.href));
  }
});

test("links multiple HTTP(S) and www URLs without consuming sentence punctuation", () => {
  const text = "Pogledaj https://mekteb.net/lekcija?a=1&b=2.\nZatim (http://example.com/test), www.example.org!";
  const parts = linkifyText(text);
  assert.equal(parts.map((part) => part.text).join(""), text);
  assert.deepEqual(parts.filter((part) => part.href), [
    { text: "https://mekteb.net/lekcija?a=1&b=2", href: "https://mekteb.net/lekcija?a=1&b=2" },
    { text: "http://example.com/test", href: "http://example.com/test" },
    { text: "www.example.org", href: "https://www.example.org/" },
  ]);
});

test("keeps balanced brackets and apostrophes inside URLs", () => {
  const text = "('https://example.com/lesson_(one)'), https://example.com/teacher's/page.";
  const parts = linkifyText(text);
  assert.equal(parts.map((part) => part.text).join(""), text);
  assert.deepEqual(parts.filter((part) => part.href).map((part) => part.text), [
    "https://example.com/lesson_(one)",
    "https://example.com/teacher's/page",
  ]);
});

test("invalid and unsafe schemes remain plain text", () => {
  const text = 'javascript:alert(1)\ndata:text/html,<script>alert(1)</script>\nhttps://\nhttps://[bad]\n<a onclick="alert(1)">tekst</a>';
  const parts = linkifyText(text);
  assert.equal(parts.map((part) => part.text).join(""), text);
  assert.ok(parts.every((part) => !part.href));
});

test("handles uppercase protocols, fragments and Unicode URLs", () => {
  const text = "HTTPS://example.com/čas#dio";
  const parts = linkifyText(text);
  assert.equal(parts[0].text, text);
  assert.equal(parts[0].href, "https://example.com/%C4%8Das#dio");
});