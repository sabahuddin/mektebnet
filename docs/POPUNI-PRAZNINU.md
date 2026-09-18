# Popuni prazninu — naša vježba ispod lekcije

Druga vježba koju platforma servira sama, bez LearningAppsa, Wordwalla i H5P-a.
Dijete čita kratku priču u kojoj nedostaju riječi i prevlači ih na prazna
mjesta. **Nova vježba znači samo novu JSON datoteku**, bez ijedne izmjene koda.

Vježba ne šalje nijedan zahtjev prema vanjskim domenama i ne postavlja kolačiće.
Font Nunito učitava se s našeg servera (`public/fonts/nunito-*.woff2`, SIL OFL).

## Kako dijete rješava

- **Mišem i prstom:** prevuče riječ na prazninu; praznina ispod prsta posvijetli.
- **Bez prevlačenja:** dodirne riječ (ona se označi), pa dodirne prazninu.
- **Tastaturom:** Tab do riječi, Enter, pa Tab do praznine i Enter.
- Tačna riječ ostaje na mjestu i pozeleni; pogrešna se vrati uz kratku poruku i
  broji se kao pogrešan pokušaj.
- **Pomozi mi** popuni jednu prazninu; koliko je puta korišteno, piše na kraju.
- Kad su sve praznine tačne, vježba javi „kraj" i stranica lekcije otključa
  dugme **Završi vježbu**.

## Kako dodati novu vježbu (5 koraka)

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
| `api-server/src/lib/nase-vjezbe.ts` | zajednički registar svih naših vježbi (čita foldere, provjerava ID, gradi URL) |
| `api-server/src/routes/nase-vjezbe.ts` | `GET /api/nase-vjezbe` — vrste i njihove vježbe za admin formu |
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
| `rijec` | riječ tačno smještena | `rijec`, `pronadjeno`, `ukupno` |
| `kraj` | sve praznine tačne | `id`, `pronadjeno`, `ukupno`, `sekunde`, `greske`, `pomoc` |

Svaka poruka nosi `izvor: "mekteb-igra"` i `igra: "popuni"`.
