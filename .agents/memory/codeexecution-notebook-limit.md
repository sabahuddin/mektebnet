---
name: Ograničenje memorije CodeExecution notebooka
description: Velike trajne JS varijable mogu resetovati notebook i prekinuti pokrenute pomoćne agente.
---

Notebook ima ograničenje memorije od 32 MiB. Prekoračenje resetuje trajne varijable i otkazuje čekajuće poslove, uključujući testiranje koje je već pokrenuto.

**Why:** Zadržani rezultati ranijih poziva i veliki GitHub tree/sadržaji zajedno su prešli ograničenje i prekinuli fokusiranu provjeru editora.

**How to apply:** Iz GitHub tree rezultata odmah izdvojiti samo potrebne putanje i SHA-ove. Ne držati stare pune rezultate, duplirane velike fajlove i job rezultate kroz dug razgovor; obrađivati ih u malim blokovima. Nakon resetovanja provjeriti već izvršene vanjske operacije prije ponavljanja.
