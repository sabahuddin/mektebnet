---
name: PWA ažuriranje bez prekida rada
description: Pravilo za aktivaciju nove web aplikacije bez nasumičnog reloadovanja već otvorenih stranica
---

PWA ažuriranje mora koristiti prompt/waiting tok: nova verzija se preuzima u
pozadini, ali čekajući service worker ne smije automatski preuzeti već otvorene
klijente. Aktivira se kada korisnik zatvori sve Mekteb tabove ili instaliranu
aplikaciju i ponovo je otvori.

**Why:** Kombinacija automatskog ažuriranja, `skipWaiting` i `clientsClaim`
preuzimala je aktivnu stranicu nakon deploya. Korisniku se to prikazivalo kao
nasumično treperenje ili ponovno učitavanje na različitim stranicama.

**How to apply:** Ne uključuj automatski `skipWaiting`/`clientsClaim` i ne šalji
poruku za aktivaciju iz `onNeedRefresh` dok korisnik radi. Ako se ikad uvede UI
za novu verziju, aktivacija mora biti izričita radnja korisnika ili se mora
odgoditi dok aplikacija više nije aktivna.