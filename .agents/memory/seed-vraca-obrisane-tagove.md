---
name: Seed vraća "obrisane" kviz tagove/kategorije
description: Zašto se admin-obrisani kviz tag/kategorija vrati nakon redeploya i kako ga trajno ukloniti.
---

# Seed vraća "obrisane" katalog stavke

Ako admin obriše kviz TAG ili KATEGORIJU iz baze, a on je i dalje u
hardkodiranoj listi u kodu, vratiće se na sljedećem startu api-servera.

**Why:** runResidualSchema (api-server index.ts) na SVAKOM startu radi
idempotentni seed iz `KVIZ_TAGOVI`/`KVIZ_TAG_KATEGORIJA_MAP`/`KVIZ_TAGOVI_META`
(i `KVIZ_KATEGORIJE_META`) u `lib/db/src/schema/content.ts` — `INSERT ... ON
CONFLICT (slug) DO NOTHING`. Pošto je Coolify redeploy = restart, svaki
redeploy re-seeduje sve što je u kodu. Brisanje samo iz baze nije dovoljno.

**How to apply:** Da trajno ukloniš tag/kategoriju: ukloni ga iz koda u
content.ts (kod tagova sva TRI mjesta zajedno — tip se izvodi iz liste pa
inače pukne TS), i iz frontend duplikata (admin-kviz-editor.tsx i
admin-banka-pitanja.tsx imaju vlastite TAG_LABELS/liste). Seed (index.ts) ne
diraj — čita liste dinamički. Tek onda očisti bazu (DELETE iz kviz_tagovi +
strip iz pitanja_banka.tagovi jsonb).

**Gotcha — frontend drift:** admin-kviz-editor.tsx koristi HARDKODIRANU
`KATEGORIJA_TAGOVI` listu (ne DB), za razliku od admin-banka-pitanja.tsx koja
vuče tagove iz API-ja. Zato obrisan tag može i dalje iskakati u kviz editoru
dok se ne ukloni i iz tog hardkodiranog niza.

## Admin-uređivani NAPAMET katalog

**Rule:** Stavka početnog NAPAMET kataloga koju admin obriše mora ostati
označena kao obrisana (soft-delete), umjesto da se njen red fizički ukloni.
Sve liste, uključujući adminovu listu skrivenih stavki, izostavljaju takve
stavke.

**Why:** Početni NAPAMET katalog se dopunjuje idempotentnim seedovanjem pri
čitanju, kako bi se svježe sure i dove iz Ilmihala mogle pojaviti. Fizički
obrisan red izgleda kao nedostajuća početna stavka i seed ga ponovo upisuje.
Soft-delete zadržava tombstone, pa `ON CONFLICT DO NOTHING` štiti adminovu
odluku, dok historijske ocjene zadržavaju stabilni identitet stavke.

**How to apply:** Za katalog koji admin može mijenjati ne oslanjaj se na
fizički `DELETE` ako se isti identitet automatski seeduje. Filtriraj
tombstoned stavke u svim prikazima i dodaj regresijski test: obriši seed
stavku, ponovo pokreni učitavanje koje seeduje, pa potvrdi da se nije vratila.
