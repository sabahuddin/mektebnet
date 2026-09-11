---
name: Bundlovani materijali i trajni uploads
description: Kako zamijeniti seedovane PDF materijale kada produkcija koristi trajni uploads volumen.
---

Bundlovana nova verzija seedovanog materijala mora prepisati postojeći fajl u trajnom `uploads` volumenu i osvježiti metapodatke postojećeg priloga.

**Why:** Deploy donese novi fajl u image, ali trajni volumen zadržava stari fajl. Logika „kopiraj samo ako ne postoji“ zato prijavi postojeći prilog kao preskočen i nastavi servirati staru verziju.

**How to apply:** Za poznate, seed-owned materijale kopirati bundlovani fajl preko postojećeg kada su izvorni i ciljni direktorij različiti. Postojeći DB red ažurirati umjesto duplirati; eksplicitno ukloniti ukinute seed-owned putanje.