---
name: Background procesi se zamrznu između tool poziva
description: Zašto nohup/long-running background skripte stanu i kako umjesto toga voziti duge poslove.
---

Dugotrajne skripte pokrenute u pozadini (`nohup ... &`) napreduju SAMO dok je aktivna neka bash komanda; čim se tool poziv završi, pozadinski proces se zamrzne (stane). Vidljivo: log napreduje par rundi tokom `sleep` komande koja je launchala posao, a onda stane na npr. 120/3513 iako proces živi (`ps` ga vidi). Nije rate-limit ni hang — kontejner pauzira background posao između turnusa.

**Why:** Reproducirano dva puta na AI batch klasifikaciji (3513 pitanja): oba puta stalo nakon prvih rundi koje su se desile dok je launch+sleep komanda još tekla.

**How to apply:** Duge poslove vozi u FOREGROUNDU u jednom bash pozivu, ograničeno da stane ispod ~120s (bash tool max timeout). Podijeli posao u chunkove (npr. `MAX=N` env) i napravi skriptu RESUMABLE (bira samo neobrađene redove, npr. `WHERE jsonb_array_length(tagovi)=0`), pa pozivaj uzastopno dok ne ostane 0. DB upisi perzistiraju i ako bash tool ubije proces na timeoutu (exit 124/-1). Dodaj i per-request SDK timeout (npr. Anthropic `{ timeout: 90000, maxRetries: 0 }`) jer SDK default nema kratak timeout.
