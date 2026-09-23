---
name: Kanonski naslovi dodijeljenih lekcija
description: Validacija naslova uz slug i normalizacija Unicode interpunkcije u API odgovoru.
---

Za naslove koji se uz slug šalju serveru na tačno poređenje koristi stabilnu kanonsku vrijednost bez tipografskih crtica.

**Why:** U testu Kur’anske zadaće API odgovor je promijenio em-crtu (—) u en-crtu (–), iako je zahtjev s prvobitnim naslovom uspješno sačuvan. Kasnije poređenje ili ponovno slanje takvog naslova može zakazati.

**How to apply:** Ako naslov mora proći egzaktno poređenje pri dodjeli/ocjenjivanju, odvoji prikazni tekst od kanonskog identiteta ili koristi jednostavan ASCII separator.