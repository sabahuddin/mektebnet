import assert from "node:assert/strict";
import test from "node:test";
import { countStudentsByTeacher } from "./teacher-student-counts.js";

test("group owners receive their students even when legacy direct links point to the head teacher", () => {
  const teachers = new Set([1, 2, 3]);
  const groups = [
    { id: 11, muallimId: 1 },
    { id: 12, muallimId: 2 },
    { id: 13, muallimId: 3 },
  ];
  const students = [
    ...Array.from({ length: 33 }, () => ({ muallimId: 1, grupaId: 11 })),
    ...Array.from({ length: 33 }, () => ({ muallimId: 1, grupaId: 12 })),
    ...Array.from({ length: 34 }, () => ({ muallimId: 1, grupaId: 13 })),
  ];

  const counts = countStudentsByTeacher(students, groups, teachers);
  assert.deepEqual(Array.from(counts.values()), [33, 33, 34]);
  assert.equal(Array.from(counts.values()).reduce((total, count) => total + count, 0), 100);
});

test("ungrouped or stale group references use the direct teacher without counting a co-teacher twice", () => {
  const counts = countStudentsByTeacher(
    [
      { muallimId: 1, grupaId: null },
      { muallimId: 2, grupaId: 999 },
      { muallimId: 1, grupaId: 13 },
      { muallimId: null, grupaId: null },
    ],
    [{ id: 13, muallimId: 3 }],
    new Set([1, 2, 3]),
  );

  assert.deepEqual(Array.from(counts.values()), [1, 1, 1]);
});