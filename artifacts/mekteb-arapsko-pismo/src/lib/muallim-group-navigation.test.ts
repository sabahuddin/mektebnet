import assert from "node:assert/strict";
import test from "node:test";
import { getGrupaModul } from "./muallim-group-navigation";

test("klik na modul kroz query-string mijenja aktivni prikaz", () => {
  assert.equal(getGrupaModul("?modul=napamet"), "napamet");
  assert.equal(getGrupaModul("?modul=greske"), "greske");
  assert.equal(getGrupaModul("?modul=plan"), "plan");
});

test("ruta grupe bez modula ostaje na učenicima", () => {
  assert.equal(getGrupaModul(""), "ucenici");
  assert.equal(getGrupaModul("?tab=grupa"), "ucenici");
  assert.equal(getGrupaModul("?modul=nepoznat"), "ucenici");
});