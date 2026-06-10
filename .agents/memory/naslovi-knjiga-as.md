---
name: Naslovi knjiga — ujednačavanje "a.s."
description: Zašto je nesklad počasnih oblika u knjige.naslov bio ﷺ simbol, a ne pisani arapski salam
---

Nesklad u `knjige.naslov` NIJE bio pisani "عليه السلام" (kojeg u naslovima
nikad nema). Vjerovjesnici su već "Ime, a.s.", a Muhammed koristi arapsku
salawat **ligaturu ﷺ (U+FDFA)** — "Muhammed ﷺ – Medinski period".

**Pravilo:** kad user traži da naslovi budu "sve a.s.", normalizuj počasne
oblike jedinstvenom regexom koja hvata ﷺ + pisani salawat (صلى الله عليه وسلم)
+ pisani salam (عليه...السلام), uz vodeći `[,\s]*`, u ", a.s." → "Muhammed, a.s.".

**Why:** prvi pokušaj je gađao samo pisani "عليه السلام" i bio potpuni no-op
(jedan uzaludan push/redeploy ciklus). Dev baza OVDJE ima ﷺ podatke pa se fix
može verifikovati direktno (`SELECT ... WHERE naslov ~ 'ﷺ|السلام|وسلم'`),
za razliku od bivše pretpostavke da dev nema arapske naslove.

**How to apply:** kao idempotentna startup-migracija u runDataBootstrap
(api-server/src/index.ts), gejtana `WHERE naslov ~ 'ﷺ|السلام|وسلم'`; vidljivo
na mekteb.net tek nakon git push + ručni Coolify redeploy.
