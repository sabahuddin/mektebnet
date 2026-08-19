import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeMuallimLessonHtml } from "./lesson-html-sanitizer.js";

const iframeHosts = ["youtube.com", "youtube-nocookie.com", "learningapps.org"];

test("uklanja izvršivi HTML i event handlere", () => {
  const result = sanitizeMuallimLessonHtml(
    `<p onclick="alert(1)">Tekst</p><script>alert(2)</script><img src="x" onerror="alert(3)">`,
    iframeHosts,
  );

  assert.equal(result.includes("<script"), false);
  assert.equal(result.includes("onclick"), false);
  assert.equal(result.includes("onerror"), false);
  assert.match(result, /<p>Tekst<\/p>/);
});

test("uklanja javascript URL i opasan inline CSS", () => {
  const result = sanitizeMuallimLessonHtml(
    `<a href="javascript:alert(1)">Link</a><span style="color:red;background:url(javascript:alert(2))">Tekst</span>`,
    iframeHosts,
  );

  assert.equal(result.includes("javascript:"), false);
  assert.match(result, /<a>Link<\/a>/);
});

test("čuva validan encoded blok interaktivne pauze", () => {
  const config = encodeURIComponent(JSON.stringify({
    id: "pause-1",
    type: "yes-no",
    question: "Da li je ovo pauza?",
    correctAnswer: true,
    correctExplanation: "Jeste.",
    wrongExplanation: "Pokušaj ponovo.",
  }));
  const input = `<p>Relevantni tekst</p><div data-lesson-pause="1" data-pause-config="${config}"></div>`;
  const result = sanitizeMuallimLessonHtml(input, iframeHosts);

  assert.match(result, /data-lesson-pause="1"/);
  assert.match(result, new RegExp(`data-pause-config="${config.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
});

test("čuva dozvoljeni iframe, a uklanja nedozvoljeni", () => {
  const allowed = sanitizeMuallimLessonHtml(
    `<iframe src="https://www.youtube-nocookie.com/embed/abc" allowfullscreen></iframe>`,
    iframeHosts,
  );
  const denied = sanitizeMuallimLessonHtml(
    `<iframe src="https://example.com/embed/abc"></iframe>`,
    iframeHosts,
  );

  assert.match(allowed, /youtube-nocookie\.com/);
  assert.equal(denied.includes("<iframe"), false);
});