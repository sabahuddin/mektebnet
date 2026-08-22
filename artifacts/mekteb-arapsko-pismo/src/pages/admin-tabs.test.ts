import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const adminSource = await readFile(
  fileURLToPath(new URL("./admin.tsx", import.meta.url)),
  "utf8",
);

const systemToolsStart = adminSource.indexOf(
  '<Tabs defaultValue="sadrzaj" className="space-y-5">',
);
const systemToolsEnd = adminSource.indexOf("\n          </Tabs>", systemToolsStart);
assert.notEqual(systemToolsStart, -1, "Admin Sistemski alati tabovi nisu pronađeni");
assert.notEqual(systemToolsEnd, -1, "Kraj admin Sistemski alati tabova nije pronađen");
const systemToolsSource = adminSource.slice(systemToolsStart, systemToolsEnd);

function getTabValuesAndLabels() {
  return [...systemToolsSource.matchAll(
    /<TabsTrigger value="([^"]+)"[^>]*>([\s\S]*?)<\/TabsTrigger>/g,
  )].map(([, value, content]) => ({
    value,
    label: content.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
  }));
}

function getPanelSource(value: string) {
  const match = systemToolsSource.match(
    new RegExp(`<TabsContent value="${value}"[^>]*>([\\s\\S]*?)</TabsContent>`),
  );
  assert.ok(match, `Panel "${value}" nije pronađen`);
  return match[1];
}

test("admin Sistemski alati imaju sve četiri kategorije sa stabilnim selektorima", () => {
  assert.deepEqual(getTabValuesAndLabels(), [
    { value: "sadrzaj", label: "Sadržaj" },
    { value: "moderacija", label: "Moderacija" },
    { value: "igre", label: "Igre" },
    { value: "odrzavanje", label: "Održavanje" },
    { value: "napamet", label: "NAPAMET" },
  ]);

  for (const value of ["sadrzaj", "moderacija", "igre", "odrzavanje"]) {
    assert.match(
      systemToolsSource,
      new RegExp(`data-testid="admin-system-tab-${value}"`),
    );
    assert.match(
      systemToolsSource,
      new RegExp(`data-testid="admin-system-content-${value}"`),
    );
  }
});

test("admin alati ostaju u svojoj kategoriji", () => {
  const panels = Object.fromEntries(
    ["sadrzaj", "napamet", "moderacija", "igre", "odrzavanje"].map(value => [
      value,
      getPanelSource(value),
    ]),
  ) as Record<string, string>;

  assert.match(panels.sadrzaj, /Rječnik pojmova/);
  assert.doesNotMatch(panels.sadrzaj, /NapametGlobalProgramEditor|KategorijeZvjezdica|PendingPrilozi|IgraPitanjaEditor|SistemAlati/);

  assert.match(panels.napamet, /NapametGlobalProgramEditor/);
  assert.doesNotMatch(panels.napamet, /KategorijeZvjezdica|PendingPrilozi|IgraPitanjaEditor|SistemAlati/);

  assert.match(panels.moderacija, /KategorijeZvjezdica/);
  assert.match(panels.moderacija, /PendingPrilozi/);
  assert.doesNotMatch(panels.moderacija, /NapametGlobalProgramEditor|IgraPitanjaEditor|SistemAlati/);

  assert.match(panels.igre, /IgraPitanjaEditor/);
  assert.doesNotMatch(panels.igre, /KategorijeZvjezdica|PendingPrilozi|SistemAlati/);

  assert.match(panels.odrzavanje, /SistemAlati/);
  assert.match(panels.odrzavanje, /Podaci i održavanje/);
  assert.doesNotMatch(panels.odrzavanje, /NapametGlobalProgramEditor|KategorijeZvjezdica|PendingPrilozi|IgraPitanjaEditor/);
});