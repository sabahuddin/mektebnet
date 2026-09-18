# Upiši odgovor — naša vježba ispod lekcije

Šesta vježba koju platforma servira sama, bez LearningAppsa, Wordwalla i H5P-a.
Dijete upisuje odgovor na pitanje. **Novu vježbu admin pravi sam, u panelu** —
bez izmjene koda i bez deploya.

Vježba ne šalje nijedan zahtjev prema vanjskim domenama i ne postavlja kolačiće.
Font Nunito učitava se s našeg servera (`public/fonts/nunito-*.woff2`, SIL OFL).

## Kako dijete rješava

- Ispod svakog pitanja je polje za upis. **Enter** vodi na sljedeće prazno
  polje, a kad su sva popunjena — na provjeru.
- Kad su sva polja popunjena, otključa se dugme **Provjeri**: tačni odgovori
  pozelene i zaključaju se, ostali se označe crveno. Svaki pogrešan odgovor
  broji se kao greška.
- Čim dijete počne popravljati odgovor, crvena oznaka nestaje.
- **Pomozi mi** upiše tačan odgovor na prvo neriješeno pitanje i zaključa ga.
- Kad su svi odgovori tačni, vježba javi „kraj" i stranica lekcije otključa
  dugme **Završi vježbu**. Na kraju piše vrijeme, koliko je bilo tačno **iz
  prve** i koliko puta je tražena pomoć.

## Kako se odgovor poredi

Poređenje je namjerno blago, jer dijete kuca na telefonu:

- **ne gledaju se velika i mala slova** — `EZAN`, `Ezan` i `ezan` su isto;
- **višak razmaka i tačka (ili uskličnik, upitnik) na kraju se zanemaruju**;
- **navodnici i zagrade oko odgovora se zanemaruju**;
- ako je sve tačno **osim kvačica** (`ceznu` umjesto `čežnju`), odgovor se
  **priznaje kao tačan**, ali dijete dobije napomenu kako se riječ tačno piše;
- u polju `prihvati` mogu se dopisati drugi oblici koji se priznaju
  (npr. `5` uz odgovor `pet`).

## Kako napraviti novu vježbu (iz admin panela)

1. **Admin panel → Vježbe → Naše vježbe → Nova vježba** (kod „Upiši odgovor").
2. Upiši naslov.
3. Za svako pitanje upiši tekst pitanja i tačan odgovor. Po želji dopiši druge
   prihvaćene odgovore (odvojene zarezom) i kratku pomoć koja stoji uz pitanje.
4. **Dodaj pitanje** za svako sljedeće (najviše dvadeset).
5. **Sačuvaj** — ispod se odmah otvori pregled onakav kakvim ga dijete vidi.

## Kako dodati novu vježbu kao datoteku uz kod

1. Napravi `artifacts/mekteb-arapsko-pismo/public/vjezbe/upisi/podaci/<ime>.json`
   (ime smije imati samo mala slova, cifre i crticu — to je ujedno ID vježbe).
2. Popuni je po uzoru na `pojmovi.json`:

   ```json
   {
     "id": "pojmovi",
     "naslov": "Upiši odgovor",
     "uputa": "Upiši odgovor u polje ispod pitanja.",
     "pitanja": [
       { "pitanje": "Kako se zove poziv na namaz?", "odgovor": "ezan", "pomoc": "Uči se s munare." },
       { "pitanje": "Koliko farz-namaza klanjamo svaki dan?", "odgovor": "pet", "prihvati": ["5"] }
     ]
   }
   ```

   | polje | značenje |
   |---|---|
   | `id` | oznaka koja se vraća u događajima vježbe |
   | `naslov` | naslov iznad pitanja i naziv u admin spisku |
   | `uputa` | jedna-dvije rečenice (nije obavezno) |
   | `pitanja` | `[{ pitanje, odgovor, prihvati?, pomoc? }]`, najviše dvadeset |

3. Push na GitHub i redeploy u Coolifyju.
4. U lekciji otvori karticu **Vježbe** → **Dodaj našu vježbu**, odaberi vrstu
   *Upiši odgovor*, pa vježbu sa spiska, i odaberi kapi meda (0, 3, 5 ili 10).
5. Provjeri je u pregledniku:
   `node artifacts/mekteb-arapsko-pismo/scripts/provjeri-upisi.mjs`
   (prije toga `pnpm run build`).

## Kako je složeno

| Fajl | Uloga |
|---|---|
| `public/vjezbe/upisi/upisi.html` | cijela vježba: pitanja, polja, poređenje odgovora, događaji |
| `public/vjezbe/upisi/podaci/*.json` | sadržaj pojedine vježbe |
| `api-server/src/lib/nase-vjezbe.ts` | zajednički registar, provjera sadržaja, URL |
| `api-server/src/routes/nase-vjezbe.ts` | spisak, sadržaj vježbe za iframe i CRUD za uređivač |
| `src/pages/admin-nase-vjezbe.tsx` | uređivač u admin panelu (kartica „Naše vježbe") |
| `src/pages/ilmihal-lekcija.tsx` | admin forma, popup vježbe, otključavanje dugmeta |

Prilog se upisuje kao `kind="embed"` sa relativnim `external_url`, pa koristi
postojeći put nagrađivanja: `POST /api/content/embed/zavrseno` dodjeljuje kapi
meda **jednom po učeniku i vježbi** (tabela `embed_completions`). `stored_name`
nosi marker `upisi:<id>`.

Ostale naše vježbe rade po istom obrascu — vidi `docs/OSMOSMJERKA.md`,
`docs/POPUNI-PRAZNINU.md`, `docs/POREDAK.md`, `docs/RAZVRSTAJ.md` i
`docs/SPOJI-PAROVE.md`.

## Događaji koje vježba šalje roditeljskoj stranici

| Događaj | Kada | Polja |
|---|---|---|
| `visina` | promjena visine sadržaja | `visina` |
| `odgovor` | odgovor potvrđen kao tačan | `pitanje`, `odgovor`, `pronadjeno`, `ukupno` |
| `kraj` | svi odgovori tačni | `id`, `pronadjeno`, `ukupno`, `sekunde`, `greske`, `pomoc`, `provjere`, `tacnoIzPrve` |

Svaka poruka nosi `izvor: "mekteb-igra"` i `igra: "upisi"`.
