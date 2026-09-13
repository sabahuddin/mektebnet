import test from "node:test";
import assert from "node:assert/strict";
import { calculateHomeworkLifecycle } from "./homework-lifecycle.js";

const createdAt = new Date("2026-09-01T10:00:00.000Z");

test("istekli rok se automatski prolongira za 7 dana", () => {
  assert.deepEqual(
    calculateHomeworkLifecycle({
      createdAt,
      originalDeadline: "2026-09-05",
      currentDeadline: null,
      prolongCount: 0,
      status: "na_cekanju",
      grade: null,
    }, new Date("2026-09-06T12:00:00.000Z")),
    { type: "prolong", deadline: "2026-09-12", prolongCount: 1 },
  );
});

test("propušteni intervali se nadoknade, ali najviše tri puta", () => {
  assert.deepEqual(
    calculateHomeworkLifecycle({
      createdAt,
      originalDeadline: "2026-09-02",
      currentDeadline: null,
      prolongCount: 0,
      status: "na_cekanju",
      grade: null,
    }, new Date("2026-09-25T12:00:00.000Z")),
    { type: "prolong", deadline: "2026-09-23", prolongCount: 3 },
  );
});

test("neocijenjena zadaća se 30. dan zatvara kao nerealizirana", () => {
  assert.deepEqual(
    calculateHomeworkLifecycle({
      createdAt,
      originalDeadline: "2026-09-05",
      currentDeadline: "2026-09-26",
      prolongCount: 3,
      status: "na_cekanju",
      grade: null,
    }, new Date("2026-10-01T00:00:00.000Z")),
    { type: "close-unrealized" },
  );
});

test("ocijenjena ili već završena zadaća se ne mijenja", () => {
  assert.deepEqual(
    calculateHomeworkLifecycle({
      createdAt,
      originalDeadline: "2026-09-05",
      currentDeadline: null,
      prolongCount: 0,
      status: "na_cekanju",
      grade: 5,
    }, new Date("2026-10-05T00:00:00.000Z")),
    { type: "none" },
  );
  assert.deepEqual(
    calculateHomeworkLifecycle({
      createdAt,
      originalDeadline: "2026-09-05",
      currentDeadline: null,
      prolongCount: 0,
      status: "zavrseno",
      grade: null,
    }, new Date("2026-10-05T00:00:00.000Z")),
    { type: "none" },
  );
});