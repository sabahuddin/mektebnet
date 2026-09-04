# Nivo 1 — etapni kvizovi (Zlatni medaljoni) i krunisanje

Reorganizacija postojećih kvizova Nivoa 1 u provjere znanja vezane za blokove
od po deset lekcija, i u tri završna kviza nivoa.

## Šta je urađeno

Nivo 1 ima **64 lekcije**, a mapa puta postavlja medaljon nakon svakih deset
lekcija — dakle **6 etapa**:

| Etapa | Lekcije | Posljednja lekcija etape | `posAfterRedoslijed` | Kviz |
|-------|---------|--------------------------|----------------------|------|
| 1 | 1–10  | Žuri Mirza na pouku | 9  | `1-etapa-1` |
| 2 | 11–20 | Dinski šarti        | 19 | `1-etapa-2` |
| 3 | 21–30 | Sura En-Nas         | 29 | `1-etapa-3` |
| 4 | 31–40 | Namaski ruknovi II  | 39 | `1-etapa-4` |
| 5 | 41–50 | Ramazanski bajram   | 49 | `1-etapa-5` |
| 6 | 51–60 | Ajetul-Kursija      | 59 | `1-etapa-6` |

Lekcije 61–64 (Zikr, Sura En-Nasr, Bajramske aktivnosti, Sport) nemaju svoj
medaljon i ulaze samo u završni ispit nivoa.

Svaki etapni kviz ima **tačno 100 pitanja isključivo iz lekcija te etape**.
`pitanjaPoSesiji` je 20, pa učenik u jednoj sesiji dobija 20 nasumičnih pitanja
— to je „mala provjera znanja nakon 10 lekcija”.

Završni ispit nivoa: tri kviza `1-krunisanje-a`, `-b`, `-c`, svaki po 100
pitanja, bez ijednog zajedničkog pitanja, svaki pokriva svih 7 blokova lekcija.
Svih 300 pitanja upisano je u `krunisanja.kviz_pitanja_ids` za Nivo 1, a server
na svakom pokušaju servira nasumičnih 100.

## Odakle pitanja

| Izvor | Broj |
|-------|------|
| 10 postojećih kvizova Nivoa 1 (`1a`…`1e` + NAPREDNI) | 572 pitanja, 530 jedinstvenih |
| Ugrađeni kvizovi lekcija (`ilmihal_lekcije.kviz_pitanja`) | 300 |
| Novonapisana pitanja iz sadržaja lekcija 1–10 | 24 |
| **Jedinstvenih kandidata ukupno** | **843** |

Svako od 530 pitanja iz postojećih kvizova ručno je razvrstano u blok lekcija
kojem sadržajno pripada — mapa je u `scripts/data/nivo1-mapa-pitanja.json`.

Lekcijska pitanja su generirana automatski i dio njih je sadržavao hrvatske
oblike, ćirilične homoglife i engleske ostatke („After breakfast”, „Tashahhud”,
„Eating dobru hranu”). 33 takva pitanja ispravljena su u
`scripts/data/nivo1-lekcijska-ispravke.json`; ispravke se primjenjuju samo pri
gradnji etapnih kvizova i ne mijenjaju same lekcije.

## Vrste pitanja i ograničenje ispita

Redovni kviz (`/kviz/:slug`) podržava svih šest vrsta pitanja. Ispit etape
(`/api/etape/...`) i ispit krunisanja serviraju samo radio-dugmad i boduju
`optionIndex`, pa mogu bodovati **samo `single` i `truefalse`**.

Zato izbor pitanja daje prednost tim vrstama, a interaktivne vrste
(`multiple`, `reorder`, `dragDrop`, `markWords`) popunjavaju preostala mjesta
u kvizu. `medaljoni.kviz_pitanja_ids` dobija samo bodivi podskup:

| Etapa | Pitanja u kvizu | Bodivih na ispitu |
|-------|-----------------|-------------------|
| 1 | 100 | 84 |
| 2 | 100 | 75 |
| 3 | 100 | 100 |
| 4 | 100 | 89 |
| 5 | 100 | 100 |
| 6 | 100 | 93 |

Sva tri kviza krunisanja sastoje se isključivo od bodivih pitanja.

## Pokretanje

```bash
pnpm --filter @workspace/scripts seed-nivo1-etape -- --dry-run   # samo plan
pnpm --filter @workspace/scripts seed-nivo1-etape                # upis
pnpm --filter @workspace/scripts test:nivo1-etape                # testovi
```

Opcije:

- `--dry-run` — ništa ne upisuje, ispiše raspodjelu pitanja.
- `--zadrzi-pozicije` — ne pomjera `posAfterRedoslijed` postojećih medaljona.
- `--bez-gatinga` — medaljoni ne zaključavaju sljedećih deset lekcija.

Skripta je idempotentna: pitanja se traže u banci po normalizovanom tekstu
(i po `meta` za `dragDrop`/`markWords`) prije nego što se ubace, kvizovi se
upsert-uju po slug-u, a veze `kviz_pitanja` se prave iznova.

## Na šta paziti pri puštanju u rad

**Medaljon postaje obavezan.** Mapa smatra etapu položenom ako medaljon nema
pitanja (`imaKviz === false`) i učenik je odradio dovoljno lekcija. Čim
medaljon dobije pitanja, etapa se računa položenom tek kad je medaljon
stvarno osvojen — a osvaja se završetkom lekcije `medaljon-nivo1-{N}`.
Skripta zato kreira te lekcije ako ne postoje, sa mini-provjerom od 10 pitanja;
postojeće medaljon-lekcije ostaju netaknute. Učenici koji su već prošli dalje
bez osvojenog medaljona vidjet će zaključane lekcije dok ne završe pripadajuću
medaljon-lekciju. Za meko uvođenje koristi `--bez-gatinga`.

**Pozicije medaljona se pomjeraju.** Ako Nivo 1 već ima medaljone na drugim
pozicijama (npr. nakon 5., 30. i 45. lekcije), skripta ih po redoslijedu
preslaguje na 10, 20, 30, 40, 50 i 60. `--zadrzi-pozicije` to sprječava.

**Seed je stariji od produkcije.** `scripts/content-seed.json.gz` ima 62 od 64
lekcije Nivoa 1 — nedostaju lekcije na pozicijama 11, 23, 24 i 56. Pitanja iz
tih lekcija nisu mogla ući u klasifikaciju; kad se seed osvježi, dovoljno je
dopuniti `nivo1-mapa-pitanja.json` i ponovo pokrenuti skriptu.

## Datoteke

- `scripts/src/nivo1-etape-lib.ts` — parsiranje pitanja, dedup, izbor po etapama, podjela krunisanja.
- `scripts/src/nivo1-etape-lib.test.ts` — testovi logike i provjera stvarnih podataka.
- `scripts/src/seed-nivo1-etape.ts` — upis u bazu.
- `scripts/data/nivo1-mapa-pitanja.json` — pitanje → blok lekcija.
- `scripts/data/nivo1-lekcijska-ispravke.json` — jezičke ispravke lekcijskih pitanja.
- `scripts/data/nivo1-nova-pitanja.json` — novonapisana pitanja.
- `artifacts/api-server/src/routes/krunisanja.ts` — nasumičnih 100 pitanja po pokušaju.
