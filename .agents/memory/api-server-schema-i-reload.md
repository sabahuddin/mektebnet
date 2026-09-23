---
name: API-server schema migracije i dev reload
description: Kako dodavati DB kolone na ovom projektu i zašto api-server dev treba ručni restart
---

## Nove DB kolone NE preko drizzle-kit push
`drizzle-kit push` je interaktivan i blokira (npr. prompt o nepovezanim
preimenovanjima), pa se ne može pouzdano vrtjeti automatski.

**Pravilo:** nove kolone/indekse dodaj kao idempotentne `ALTER TABLE ... ADD
COLUMN IF NOT EXISTS` (i `CREATE INDEX IF NOT EXISTS`) u residual-schema startup
funkciji u `artifacts/api-server/src/index.ts` (blok koji loguje "Residual schema
... ready"). Ta funkcija se vrti pri svakom bootu.

**Why:** tako se ista schema automatski primijeni i na produkciju (self-hosted
mekteb.net) na sljedećem redeployu — bez ručnog psql ALTER na prod bazi, koji se
lako zaboravi i obori feature s 500 ("column does not exist").

**How to apply:** dodaj ALTER prije završne `logger.info(...ready)` linije i
dopuni tekst log poruke; nikad se ne oslanjaj na `drizzle-kit push` za prod.

## List endpoint može raditi dok su svi detalji pokvareni
Kad javni katalog vrati lekcije, to ne dokazuje da se ijedna lekcija može
otvoriti. Stara self-hosted produkcijska šema može imati sve kolone koje
lista projicira, a nemati novu kolonu koju detalj čita kroz sva polja.

**Why:** produkcija je imala stotine lekcija na listi, ali svaki detalj je
vraćao 500 zbog nedostajuće kolone; frontend je 500 pogrešno prikazivao kao
„Lekcija nije pronađena”.

**How to apply:** kod prijave praznih/nedostupnih lekcija provjeri status i
liste i konkretnog detail URL-a, zatim uporedi šemu produkcije sa čitanim
kolonama. Razdvoji poruku za 404 od 500 i loguj serversku grešku.

## api-server dev NE reloada pouzdano
Nakon izmjena backend koda (rute, schema), dev server često i dalje vrti stari
build (npr. nove rute vraćaju 404, `/muallim/info` ne vraća nova polja).

**How to apply:** poslije svake backend izmjene pozovi
`restart_workflow("artifacts/api-server: API Server")` prije curl/e2e testa.
