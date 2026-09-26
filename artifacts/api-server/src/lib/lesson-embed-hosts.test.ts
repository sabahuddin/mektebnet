import { test } from "node:test";
import assert from "node:assert/strict";
import { extractEmbedSrc, findDisallowedIframeSrcs, isAllowedNewEmbedUrl } from "./lesson-embed-hosts.js";

test("nove vanjske vježbe prihvataju samo četiri navedena izvora", () => {
  for (const url of [
    "https://learningapps.org/watch?v=123",
    "https://wordwall.net/resource/123",
    "https://wayground.com/embed/quiz/123",
    "https://play.kahoot.it/v2/123",
  ]) {
    assert.equal(isAllowedNewEmbedUrl(url), true, url);
    assert.equal(isAllowedNewEmbedUrl(extractEmbedSrc(`<iframe src="${url}"></iframe>`)!), true, url);
  }
  for (const url of [
    "https://view.genial.ly/123",
    "https://quizizz.com/embed/123",
    "https://padlet.com/example",
    "https://embed.mentimeter.com/123",
    "https://h5p.org/h5p/embed/123",
    "https://wayground.com.evil.example/123",
    "javascript:alert(1)",
  ]) {
    assert.equal(isAllowedNewEmbedUrl(url), false, url);
  }
});

test("uređivanje ne briše stare iframeove, ali odbija nove sa starih izvora", () => {
  const old = '<iframe src="https://view.genial.ly/123?x=1&amp;y=2"></iframe>';
  const unchanged = '<iframe src="https://view.genial.ly/123?x=1&y=2"></iframe>';
  const duplicate = `${unchanged}${unchanged}`;
  const newSource = '<iframe src="https://padlet.com/example"></iframe>';
  assert.deepEqual(findDisallowedIframeSrcs(unchanged, old), []);
  assert.deepEqual(findDisallowedIframeSrcs(duplicate, old), ["https://view.genial.ly/123?x=1&y=2"]);
  assert.deepEqual(findDisallowedIframeSrcs(`${unchanged}${newSource}`, old), ["https://padlet.com/example"]);
  assert.deepEqual(findDisallowedIframeSrcs(newSource), ["https://padlet.com/example"]);
  assert.deepEqual(findDisallowedIframeSrcs(
    '<iframe src="https://wayground.com/embed/quiz/1"></iframe><iframe src="https://www.youtube.com/embed/1"></iframe>',
  ), []);
});