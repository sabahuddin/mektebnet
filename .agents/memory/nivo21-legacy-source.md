---
name: Nivo 21 je samo stari izvor
description: Pravilo za obradu istorijskog nivo21 segmenta bez vraćanja internog nivoa 21 u bazu.
---

Istorijski izvor sadržaja je drugi dio današnjeg Nivoa 2 nazivao `nivo21`. Taj naziv može ostati samo na granici starog izvora, ali se svaki takav zapis mora mapirati na kanonski `nivo=2`. Baza i korisnički interfejs smiju koristiti samo nivoe 1, 2 i 3.

**Why:** Stara import/backfill kompatibilnost mogla je ponovo proizvesti nivo 21 iako su sadržaji već odavno objedinjeni u Nivo 2.

**How to apply:** Svaki novi import, backfill ili seed koji čita istorijski `nivo21` mora ga odmah normalizovati na 2 i ne smije imati fallback koji čita ili upisuje `nivo=21`.