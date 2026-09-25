import assert from "node:assert/strict";
import test from "node:test";
import { canAccessAdminRoute, requiresLessonEditingPermission } from "./admin-route-access.js";

test("admin zadržava pristup svim admin rutama", () => {
  assert.equal(canAccessAdminRoute({
    role: "admin",
    method: "DELETE",
    path: "/ilmihal/12",
  }), true);
});

test("muallim može poslati samo contentHtml postojeće Ilmihal lekcije", () => {
  assert.equal(canAccessAdminRoute({
    role: "muallim",
    method: "PUT",
    path: "/ilmihal/12",
    body: { contentHtml: "<p>Lekcija</p>" },
  }), true);
});

test("muallim ne može uz sadržaj promijeniti admin polje", () => {
  assert.equal(canAccessAdminRoute({
    role: "muallim",
    method: "PUT",
    path: "/ilmihal/12",
    body: { contentHtml: "<p>Lekcija</p>", naslov: "Novi naslov" },
  }), false);
});

test("muallim ne može mijenjati samo druga polja Ilmihal lekcije", () => {
  assert.equal(canAccessAdminRoute({
    role: "muallim",
    method: "PUT",
    path: "/ilmihal/12",
    body: { predmet: "Ahlak" },
  }), false);
});

test("muallim može predložiti novu Ilmihal lekciju, ali je ne može obrisati", () => {
  assert.equal(canAccessAdminRoute({
    role: "muallim",
    method: "POST",
    path: "/ilmihal",
    body: { naslov: "Nova lekcija", nivo: 1, contentHtml: "<p>Lekcija</p>" },
  }), true);
  assert.equal(canAccessAdminRoute({
    role: "muallim",
    method: "POST",
    path: "/ilmihal",
    body: { contentHtml: "<p>Lekcija</p>" },
  }), false);
  assert.equal(canAccessAdminRoute({
    role: "muallim",
    method: "DELETE",
    path: "/ilmihal/12",
  }), false);
});

test("neispravan ID i contentHtml tip ne otvaraju muallim pristup", () => {
  assert.equal(canAccessAdminRoute({
    role: "muallim",
    method: "PUT",
    path: "/ilmihal/nepoznato",
    body: { contentHtml: "<p>Lekcija</p>" },
  }), false);
  assert.equal(canAccessAdminRoute({
    role: "muallim",
    method: "PUT",
    path: "/ilmihal/12",
    body: { contentHtml: null },
  }), false);
});

test("postojeći muallim pristup prilozima i uploadu ostaje dozvoljen", () => {
  assert.equal(canAccessAdminRoute({
    role: "muallim",
    method: "POST",
    path: "/prilozi/12",
  }), true);
  assert.equal(canAccessAdminRoute({
    role: "muallim",
    method: "POST",
    path: "/upload",
  }), true);
});

test("muallim može dodati Embed, ali H5P i naše vježbe ostaju admin-only", () => {
  assert.equal(canAccessAdminRoute({
    role: "muallim",
    method: "POST",
    path: "/prilozi/12/embed",
  }), true);
  for (const suffix of ["h5p", "osmosmjerka", "nasa-vjezba"]) {
    assert.equal(canAccessAdminRoute({
      role: "muallim",
      method: "POST",
      path: `/prilozi/12/${suffix}`,
    }), false, suffix);
  }
});

test("isključeno uređivanje blokira samo mutacije lekcija i materijala", () => {
  for (const [method, path] of [
    ["POST", "/prilozi/12"],
    ["PUT", "/prilozi/12"],
    ["PUT", "/prilozi/12/redoslijed"],
    ["DELETE", "/prilozi/12"],
    ["POST", "/ilmihal"],
    ["PUT", "/ilmihal/12"],
    ["DELETE", "/ilmihal/12"],
  ]) {
    assert.equal(requiresLessonEditingPermission(method, path), true, `${method} ${path}`);
    assert.equal(canAccessAdminRoute({
      role: "muallim",
      method,
      path,
      body: { contentHtml: "<p>Lesson</p>" },
      canEditLessons: false,
    }), false, `${method} ${path}`);
  }
});

test("čitanja i admin bypass nisu zahvaćeni dozvolom za uređivanje", () => {
  for (const path of ["/prilozi/12", "/prilozi/download/12", "/ilmihal/12", "/upload"]) {
    assert.equal(requiresLessonEditingPermission("GET", path), false, path);
  }
  assert.equal(requiresLessonEditingPermission("HEAD", "/prilozi/download/12"), false);
  // Generički upload služi i za poruke roditeljima; tek povezivanje fajla
  // s lekcijom preko /prilozi zahtijeva dozvolu za uređivanje.
  assert.equal(requiresLessonEditingPermission("POST", "/upload"), false);
  assert.equal(canAccessAdminRoute({
    role: "muallim",
    method: "POST",
    path: "/upload",
    canEditLessons: false,
  }), true);
  assert.equal(canAccessAdminRoute({
    role: "muallim",
    method: "GET",
    path: "/prilozi/download/12",
    canEditLessons: false,
  }), true);
  assert.equal(canAccessAdminRoute({
    role: "admin",
    method: "DELETE",
    path: "/ilmihal/12",
    canEditLessons: false,
  }), true);
});

test("ostale uloge ne mogu pristupiti admin rutama", () => {
  for (const role of ["ucenik", "roditelj", "gost", undefined]) {
    assert.equal(canAccessAdminRoute({
      role,
      method: "PUT",
      path: "/ilmihal/12",
      body: { contentHtml: "<p>Lekcija</p>" },
    }), false);
  }
});
test("sigurnosna kopija je samo za admina", () => {
  for (const path of ["/sigurnosna-kopija", "/sigurnosna-kopija/pregled"]) {
    assert.equal(canAccessAdminRoute({ role: "admin", method: "GET", path }), true, path);
    assert.equal(canAccessAdminRoute({ role: "muallim", method: "GET", path }), false, path);
    assert.equal(canAccessAdminRoute({ role: "ucenik", method: "GET", path }), false, path);
    assert.equal(canAccessAdminRoute({ method: "GET", path }), false, path);
  }
});

test("kopija fajlova je samo za admina", () => {
  const path = "/sigurnosna-kopija/fajlovi";
  assert.equal(canAccessAdminRoute({ role: "admin", method: "GET", path }), true);
  assert.equal(canAccessAdminRoute({ role: "muallim", method: "GET", path }), false);
  assert.equal(canAccessAdminRoute({ role: "ucenik", method: "GET", path }), false);
});
