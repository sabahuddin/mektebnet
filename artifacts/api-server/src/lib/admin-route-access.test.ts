import assert from "node:assert/strict";
import test from "node:test";
import { canAccessAdminRoute } from "./admin-route-access.js";

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

test("muallim ne može kreirati ili obrisati Ilmihal lekciju", () => {
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
