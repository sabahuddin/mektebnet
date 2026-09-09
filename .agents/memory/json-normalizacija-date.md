---
name: JSON normalizacija i Date objekti
description: Pravilo za globalne transformacije API JSON odgovora bez kvarenja posebnih JavaScript objekata.
---

Globalne rekurzivne transformacije JSON odgovora smiju obilaziti nizove i obične objekte, ali moraju ostaviti `Date` i druge posebne objekte netaknute.

**Why:** `Object.entries(new Date())` je prazan, pa opći object-mapper pretvori datum u `{}`. Nakon JSON odgovora frontend iz toga dobije `Invalid Date`, iako su podaci u bazi ispravni.

**How to apply:** Prije rekurzije provjeri prototype i obrađuj samo plain objekte; regresijski test treba potvrditi da `JSON.stringify` nakon transformacije i dalje daje ISO datum.