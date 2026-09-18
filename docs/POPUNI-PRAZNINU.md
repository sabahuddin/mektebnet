# Popuni prazninu — naša vježba ispod lekcije

Druga vježba koju platforma servira sama, bez LearningAppsa, Wordwalla i H5P-a.
Dijete čita kratku priču u kojoj nedostaju riječi i prevlači ih na prazna
mjesta. **Novu vježbu admin pravi sam, u panelu** — bez izmjene koda i bez
deploya. Vježbe koje idu uz kod i dalje mogu biti JSON datoteke u repozitoriju.

Vježba ne šalje nijedan zahtjev prema vanjskim domenama i ne postavlja kolačiće.
Font Nunito učitava se s našeg servera (`public/fonts/nunito-*.woff2`, SIL OFL).

## Kako dijete rješava

- **Mišem i prstom:** prevuče riječ na prazninu; praznina ispod prsta posvijetli.
- **Bez prevlačenja:** dodirne riječ (ona se označi), pa dodirne prazninu.
- **Tastaturom:** Tab do riječi, Enter, pa Tab do praznine i Enter.
- **Svaka riječ se prihvata, i kad nije tačna.** Dijete slaže cijelu priču kako
  misli da treba; dok slaže, nema nijedne crvene oznake.
- Predomisli li se, dodirne riječ u priči i ona se vrati među ponuđene.
- Kad su sve praznine popunjene, otključa se dugme **Provjeri**. Tek tada
  tačne riječi pozelene i zaključaju se, a pogrešne se označe crveno — dijete
  ih vrati i pokuša ponovo. Svaka pogrešno smještena riječ broji se kao greška.
- **Pomozi mi** riješi prazninu na kojoj je dijete zapelo (praznu ili pogrešno
  popunjenu) i odmah je oboji zeleno; koliko je puta korišteno, piše na kraju.
- Kad su sve praznine tačne, vježba javi „kraj" i stranica lekcije otključa
  dugme **Završi vježbu**. Na kraju piše vrijeme, koliko je bilo tačno **iz
  prve**, koliko je bilo grešaka i koliko puta je tražena pomoć.

## Kako napraviti novu vježbu (iz admin panela)

1. **Admin panel → Vježbe → Naše vježbe → Nova vježba** (kod „Popuni prazninu").
2. Upiši naslov i priču.
3. Označi riječ u priči mišem pa klikni **Označi riječ kao prazninu** — riječ
   dobije vitičaste zagrade i postaje prazno mjesto. Prazan red pravi novi pasus.
4. Po želji dopiši **dodatne riječi** (odvojene zarezom) koje nigdje ne trebaju.
5. **Sačuvaj** — ispod se odmah otvori pregled onakav kakvim ga dijete vidi.

Vježba se čuva u bazi (`nase_vjezbe`) i odmah je dostupna u lekciji, bez
deploya. Oznaka (dio adrese) se pravi iz naslova ako je ne upišeš sam, a poslije
čuvanja se više ne mijenja, jer lekcije pokazuju na nju.

Ugrađene vježbe (one koje idu uz kod) stoje u istom spisku. Kad ih izmijeniš,
izmjena se upiše u bazu i od tada prekriva ugrađenu; **Obriši** vraća ugrađenu
verziju. Dugme **Kopiraj** pravi novu vježbu od postojeće.

## Kako dodati novu vježbu kao datoteku uz kod (5 koraka)

Ovaj put je i dalje tu za vježbe koje idu uz kod (idu u git i u svaki deploy).


1. Napravi datoteku `artifacts/mekteb-arapsko-pismo/public/vjezbe/popuni/podaci/<ime>.json`
   (ime smije imati samo mala slova, cifre i crticu — to je ujedno ID vježbe).
2. Popuni je po uzoru na `abdest.json`:

   ```json
   {
     "id": "abdest-01",
     "naslov": "Ammar i Lejla uzimaju abdest",
     "uputa": "Prevuci riječ na prazno mjesto.",
     "tekst": "Prije namaza uzimamo {abdest}.\n\nPrvo operemo {šake} tri puta.",
     "dodatne": ["sanke", "lopta"]
   }
   ```

   | polje | značenje |
   |---|---|
   | `id` | oznaka koja se vraća u događajima vježbe |
   | `naslov` | naslov iznad priče i naziv u admin spisku |
   | `uputa` | jedna-dvije rečenice (nije obavezno) |
   | `tekst` | priča; riječ u vitičastim zagradama postaje praznina. Prazan red pravi novi pasus |
   | `dodatne` | riječi koje nigdje ne trebaju, da ne bude prelako (nije obavezno) |
   | `poredaj` | `mijesaj` (zadano) ili `redom` za redoslijed ponuđenih riječi |

   Ista riječ smije se pojaviti na više mjesta — tada se u ponudi pojavi
   onoliko puta koliko praznina popunjava. Poređenje ne razlikuje velika i mala
   slova. Za nazive i termine vrijedi transkripcija po Pravilima Rijaseta.
3. Push na GitHub i redeploy u Coolifyju (spisak se čita s diska pri svakom
   pozivu, pa nema migracije ni unosa u bazu).
4. U lekciji otvori karticu **Vježbe** → **Dodaj našu vježbu**, odaberi vrstu
   *Popuni prazninu*, pa vježbu sa spiska, i odaberi kapi meda (0, 3, 5 ili 10).
5. Provjeri je u pregledniku:
   `node artifacts/mekteb-arapsko-pismo/scripts/provjeri-popuni.mjs`
   (prije toga `pnpm run build`; u skripti promijeni `PODACI` na novu datoteku).

## Kako je složeno

| Fajl | Uloga |
|---|---|
| `public/vjezbe/popuni/popuni.html` | cijela vježba: priča, praznine, prevlačenje, tastatura, događaji |
| `public/vjezbe/popuni/podaci/*.json` | sadržaj pojedine vježbe |
| `api-server/src/lib/nase-vjezbe.ts` | zajednički registar (ugrađene datoteke + tabela `nase_vjezbe`), provjera sadržaja, URL |
| `api-server/src/routes/nase-vjezbe.ts` | spisak, sadržaj vježbe za iframe i CRUD za uređivač u panelu |
| `src/pages/admin-nase-vjezbe.tsx` | uređivač u admin panelu (kartica „Naše vježbe") |
| `api-server/src/routes/admin.ts` | `POST /api/admin/prilozi/:lekcijaId/nasa-vjezba` |
| `src/pages/ilmihal-lekcija.tsx` | admin forma, popup vježbe, otključavanje dugmeta |

Prilog se upisuje kao `kind="embed"` sa relativnim `external_url`, pa koristi
postojeći put nagrađivanja: `POST /api/content/embed/zavrseno` dodjeljuje kapi
meda **jednom po učeniku i vježbi** (tabela `embed_completions`). `stored_name`
nosi marker `popuni:<id>`, a stranica lekcije prepoznaje našu vježbu po adresi.

Osmosmjerka radi po istom obrascu — vidi `docs/OSMOSMJERKA.md`.

## Događaji koje vježba šalje roditeljskoj stranici

| Događaj | Kada | Polja |
|---|---|---|
| `visina` | promjena visine sadržaja | `visina` |
| `rijec` | praznina potvrđena kao tačna (pri provjeri ili kroz pomoć) | `rijec`, `pronadjeno`, `ukupno` |
| `kraj` | sve praznine tačne | `id`, `pronadjeno`, `ukupno`, `sekunde`, `greske`, `pomoc`, `provjere`, `tacnoIzPrve` |

Svaka poruka nosi `izvor: "mekteb-igra"` i `igra: "popuni"`.

Treća naša vježba, „Poredak", radi po istom obrascu — vidi `docs/POREDAK.md`.
