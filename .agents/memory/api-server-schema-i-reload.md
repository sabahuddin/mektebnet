---
name: API-server schema migracije i dev reload
description: Kako dodavati DB kolone na ovom projektu i zašto api-server dev treba ručni restart
---

## Drizzle je primarni put, ali parcijalna produkcija traži catch-up
`drizzle-kit push` je interaktivan i nepouzdan. Trenutni startup koristi
Drizzle SQL migracije kao primarni put. Stara self-hosted produkcija može zapeti
na ranijoj migraciji zbog tabele koja već postoji i time ne primijeniti nijednu
noviju migraciju. Za nove tabele koje rute odmah koriste dodaj ciljani,
idempotentni `CREATE TABLE IF NOT EXISTS` fallback na startupu, odvojeno od
Drizzle migracije, i prijavi neuspjeh u logu.

**Why:** razvojna baza može uredno primijeniti migraciju, a produkcija nastaviti
rad bez nove tabele i vratiti 500 na novoj funkciji. Drizzle generator uz stariji
snapshot može istovremeno predložiti niz duplih CREATE naredbi za tabele koje
su već dodane ručnim migracijama ili residual kodom.

**How to apply:** mijenjaj schema model, generiši Drizzle migraciju, pregledaj
SQL prije commita i ukloni nepovezane/duple CREATE naredbe; sačuvaj snapshot i
journal konzistentnim. Ne radi `push` ni ručni upis direktno u produkcijsku
bazu. Za poznatu parcijalnu produkciju dodaj uski fallback, ne generalno
redefinisanje postojeće šeme.

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
