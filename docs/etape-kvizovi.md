# Etapni kvizovi (Zlatni medaljoni) i krunisanje

Postojeći kvizovi Nivoa 1, 2 i 3 razvrstani su u provjere znanja vezane za
blokove od po deset lekcija, i u završne kvizove nivoa.

## Struktura

Etapa je blok od deset lekcija, u skladu sa `kvizovi.etapa` (1 = lekcije 1–10,
2 = 11–20 itd.). Nivoi 1 i 2 imaju **sedam etapa**, a Nivo 3 sa svojih 100
lekcija ima **deset**. Etapni kviz se veže za medaljon-lekciju
`medaljon-nivo{N}-{etapa}` preko `kvizovi.lekcija_id`.

| Nivo | Lekcija | Etapa | Posljednja etapa pokriva | Kvizovi |
|------|---------|-------|--------------------------|---------|
| 1 | 62 u seedu (`redoslijed` 0–63, nedostaju 10, 22, 23, 55) | 7 | lekcije 61–64 | `1-etapa-1`…`1-etapa-7`, `1-krunisanje-a/b/c` |
| 2 | 68 (`redoslijed` 0–67, nedostaje 29) + uvodna na −10 | 7 | lekcije 61–68 | `2-etapa-1`…`2-etapa-7`, `2-krunisanje-a/b/c` |
| 3 | 100 (`redoslijed` 0–99) | 10 | lekcije 91–100 | `3-etapa-1`…`3-etapa-10`, `3-krunisanje-a/b/c` |

Etapni kviz prikazuje **sva** svoja pitanja (`pitanjaPoSesiji` se ne postavlja),
prag prolaza je **80%**, a nakon neuspjelog pokušaja novi je zaključan 48 sati.
Medaljon-lekcija se ne može završiti dok etapni kviz nije položen — to provjerava
server (`artifacts/api-server/src/routes/content.ts`).

## Broj pitanja

Svaki kviz ima 100 pitanja, osim `1-etapa-7` koja ih ima 93 — pokriva samo četiri
lekcije (Zikr, Sura En-Nasr, Bajramske aktivnosti, Sport). Ukupno je to 17
etapnih kvizova i 9 kvizova krunisanja.

## Odakle pitanja

| Izvor | Nivo 1 | Nivo 2 | Nivo 3 |
|-------|--------|--------|--------|
| Postojeći kvizovi | 572 pitanja, 530 jedinstvenih | 1093 pitanja, 989 jedinstvenih | 948 pitanja, 867 jedinstvenih |
| Ugrađeni kvizovi lekcija | 305 | 348 | 500 |
| Novonapisana pitanja | 82 | 58 | 100 |

Svako pitanje iz postojećih kvizova ručno je razvrstano u blok lekcija kojem
sadržajno pripada — mape su u `scripts/data/nivo{1,2,3}-mapa-pitanja.json`.
Vrijednost `0` u mapama Nivoa 2 i 3 označava pitanja koja ponavljaju gradivo
prethodnih nivoa; ona ne ulaze ni u jednu etapu, nego samo u bazen krunisanja.

Ugrađeni kvizovi lekcija dolaze u dva oblika — kao niz `{question, options,
answer}` i, kod novijih lekcija Nivoa 2, kao JSON string sa `{pitanje, odgovori,
tacanOdgovor}`. Oba se svode na isti oblik u `lekcijskaPitanja()`.

## Ispravke izvornih podataka

Ispravke se primjenjuju samo pri gradnji etapnih kvizova i ne mijenjaju izvorne
lekcije ni kvizove:

- `nivo1-lekcijska-ispravke.json` — 33 lekcijska pitanja Nivoa 1 sa hrvatskim
  oblicima, ćiriličnim homoglifima i engleskim ostacima („After breakfast",
  „Tashahhud", „Eating dobru hranu").
- `nivo2-kviz-ispravke.json` — 29 pitanja Nivoa 2: dva kojima tačan odgovor nije
  odgovarao nijednoj opciji, i 27 „pronađi grešku" pitanja kojima je polje
  `incorrect` bilo prazno ili je pokazivalo van niza riječi.
- `nivo3-kviz-ispravke.json` — 17 pitanja Nivoa 3 kojima zapisani tačan odgovor
  („DA", „r.a.", „Musa"…) nije bio nijedna od ponuđenih opcija; ispravan odgovor
  je u svakom slučaju izveden iz obrazloženja samog pitanja.

## Pokrivenost lekcija

Svaka lekcija zadržava najmanje dva svoja pitanja u kvizu svoje etape
(`MIN_PO_LEKCIJI`), pa nijedna ne ispada iz kviza ni kad etapa ima višestruko
više kandidata nego mjesta. Bez svojih pitanja ostaju samo dvije lekcije koje su
u seedu prazne: `tesbih` (Nivo 1) i `uvodna-rijec-nivo-2` (Nivo 2). Nivo 1 je
tako pokriven 61/62, Nivo 2 67/68, a Nivo 3 svih 100/100 lekcija.

## Vrste pitanja

Etapni kviz ide kroz redovni kviz UI i podržava svih šest vrsta (`single`,
`multiple`, `truefalse`, `reorder`, `dragDrop`, `markWords`). Ispit krunisanja
prikazuje samo radio-dugmad i boduje jedan izabrani indeks, pa se kvizovi
krunisanja sastoje isključivo od `single` i `truefalse` pitanja.

## Pokretanje

```bash
pnpm --filter @workspace/scripts export-etape -- --nivo 1     # JSON za ručni uvoz
pnpm --filter @workspace/scripts export-etape -- --nivo 2
pnpm --filter @workspace/scripts export-etape -- --nivo 3
pnpm --filter @workspace/scripts test:nivo1-etape             # testovi
```

Izvoz radi potpuno offline — čita `scripts/content-seed.json.gz` i podatke iz
`scripts/data/`, bez dodira sa bazom. Rezultat ide u `.local/nivo{N}-kvizovi/`.

Postoji i `seed-nivo1-etape.ts`, koji isto upisuje direktno u bazu. Nastao je
prije nego što su uvedeni `kvizovi.etapa` i vezivanje cijelog kviza za
medaljon-lekciju, pa ga treba uskladiti prije ponovne upotrebe.

## Datoteke

- `scripts/src/nivo1-etape-lib.ts` — parsiranje pitanja, dedup, izbor po etapama, podjela krunisanja.
- `scripts/src/nivo1-etape-lib.test.ts` — testovi logike i provjera stvarnih podataka za sva tri nivoa.
- `scripts/src/nivo1-kategorije.ts` — dodjela kategorije i tagova po ključnim riječima.
- `scripts/src/export-etape.ts` — izvoz u JSON za ručni uvoz.
- `scripts/src/seed-nivo1-etape.ts` — upis u bazu (zastarjelo, vidi gore).
- `scripts/data/nivo{1,2,3}-mapa-pitanja.json` — pitanje → blok lekcija.
- `scripts/data/nivo1-lekcijska-ispravke.json`, `scripts/data/nivo{2,3}-kviz-ispravke.json` — ispravke izvora.
- `scripts/data/nivo{1,2,3}-nova-pitanja.json` — novonapisana pitanja.
