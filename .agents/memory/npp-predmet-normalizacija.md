---
name: NPP normalizacija predmeta lekcija
description: Kanonske kategorije predmeta (dropdown filter) i kako se primjenjuju na prod.
---

Kolona `ilmihal_lekcije.predmet` napaja dropdown filter na "Sve lekcije".
Kategorije su normalizovane na 6 oblasti i moraju imati iste prikazne nazive u
lekcijama i Banci pitanja:
**Kiraet, Vjerovanje, Ibadet, Ahlak, Historija islama, Ostali sadržaji**.

**Konvencije:**
- Necore sadržaj (kultura, tradicija, domovina, jezik, bajram-aktivnosti, uvodne
  riječi) → "Ostali sadržaji" (po NPP-u, ne zasebne kategorije).
- Medaljon-lekcije (slug `medaljon-nivo%`) NAMJERNO ostaju bez predmeta — nisu
  nastavni sadržaj, ne smiju dobiti oblast.
- Sve lekcije čiji naslov ili slug označava Suru pripadaju **Kiraetu**; tag
  pitanja `sure` također pripada kategoriji `kiraet`.
- Legacy naziv **Ibadet i praksa** uvijek se spaja u **Ibadet**.

**Why / kako se primjenjuje:** produkcija je self-hosted (Coolify), pa se data-
izmjene dostavljaju kao idempotentna startup-migracija u api-server index.ts
(uz postojeći predmet backfill), koja se izvrši pri ručnom redeployu. Value-remap
(legacy→kanonsko) je idempotentan; slug-dodjele su NULL-guarded da ne pregaze
ručne admin izmjene na sljedećem redeployu.
