import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { cleanupH5PInstance } from "./h5p-player-lifecycle";

test("cleanup uklanja H5P DOM, integration zapis i samo ugašenu instancu", () => {
  const dom = new JSDOM(`
    <div id="player">
      <div class="h5p-iframe">
        <div class="h5p-content" data-content-id="mekteb-h5p-1"></div>
      </div>
    </div>
  `);
  const runtime = {
    H5P: {
      instances: [
        { contentId: "mekteb-h5p-1" },
        { contentId: "mekteb-h5p-2" },
      ],
    },
    H5PIntegration: {
      contents: {
        "cid-mekteb-h5p-1": { title: "Stara instanca" },
        "cid-mekteb-h5p-2": { title: "Nova instanca" },
      },
    },
  };

  cleanupH5PInstance(runtime, dom.window.document.getElementById("player"), "mekteb-h5p-1");

  assert.equal(dom.window.document.querySelector(".h5p-iframe"), null);
  assert.deepEqual(runtime.H5P.instances, [{ contentId: "mekteb-h5p-2" }]);
  assert.deepEqual(runtime.H5PIntegration.contents, {
    "cid-mekteb-h5p-2": { title: "Nova instanca" },
  });
});

test("cleanup je siguran ako je DOM već uklonjen", () => {
  const runtime = {
    H5P: { instances: [{ contentId: "mekteb-h5p-3" }] },
    H5PIntegration: { contents: { "cid-mekteb-h5p-3": {} } },
  };

  cleanupH5PInstance(runtime, null, "mekteb-h5p-3");

  assert.deepEqual(runtime.H5P.instances, []);
  assert.deepEqual(runtime.H5PIntegration.contents, {});
});