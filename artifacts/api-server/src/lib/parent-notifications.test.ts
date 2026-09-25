import { test } from "node:test";
import assert from "node:assert/strict";
import { notificationLang, parentNotification } from "./parent-notifications.js";

test("roditeljski jezik je nezavisan od muallima i nepoznat jezik pada na bosanski", () => {
  assert.equal(notificationLang("de"), "de");
  assert.equal(notificationLang(null), "bs");
  assert.equal(notificationLang("tr"), "bs");
});

test("svaki roditelj dobija naslov i sadržaj zadaće na svom jeziku", () => {
  const event = { type: "homework", child: "Amina", title: "Sura El-Fatiha" } as const;
  for (const lang of ["bs", "en", "de", "sq"] as const) {
    const message = parentNotification(event, lang);
    assert.ok(message.naslov.includes("Amina"));
    assert.ok(message.sadrzaj.includes("Sura El-Fatiha"));
  }
  assert.match(parentNotification(event, "de").naslov, /Neue Hausaufgabe/);
  assert.match(parentNotification(event, "en").naslov, /New homework/);
});

test("opisne ocjene se prevode, brojčane ostaju iste", () => {
  const event = { type: "grade", child: "Amina", grade: "Urađeno", subject: "Napamet" } as const;
  assert.match(parentNotification(event, "en").sadrzaj, /Completed.*Memorization/);
  assert.match(parentNotification(event, "de").sadrzaj, /Auswendiglernen.*Erledigt/);
  assert.match(parentNotification(event, "sq").sadrzaj, /E kryer.*Përmendësh/);
  assert.match(parentNotification({ type: "grade", child: "Amina", grade: "5", subject: "Vjerovanje" }, "en").sadrzaj, /Faith/);
  assert.match(parentNotification({ type: "homeworkGrade", child: "Amina", grade: "5" }, "en").sadrzaj, /grade of 5/);
});