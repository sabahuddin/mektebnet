# Spoji parove — naša vježba ispod lekcije

Peta vježba koju platforma servira sama, bez LearningAppsa, Wordwalla i H5P-a.
Lijevo stoje pojmovi, a odgovori se prevlače uz njih. **Novu vježbu admin pravi
sam, u panelu** — bez izmjene koda i bez deploya.

Vježba ne šalje nijedan zahtjev prema vanjskim domenama i ne postavlja kolačiće.
Font Nunito učitava se s našeg servera (`public/fonts/nunito-*.woff2`, SIL OFL).

## Kako dijete rješava

- **Mišem i prstom:** prevuče odgovor na prazno mjesto uz pojam.
- **Bez prevlačenja:** dodirne odgovor (ona se označi), pa dodirne mjesto uz pojam.
- **Tastaturom:** Tab do odgovora, Enter, pa Tab do mjesta uz pojam i Enter.
- **Svaki odgovor se prihvata, i kad nije tačan.** Dok spaja, nema nijedne
  zelene ni crvene oznake. Dodirom na smješten odgovor vraća ga u ponudu.
- Kad su svi parovi spojeni, otključa se dugme **Provjeri**: tačni parovi
  pozelene i zaključaju se, ostali se označe crveno. Svaki pogrešan par broji
  se kao greška.
- **Pomozi mi** spoji jedan par i zaključa ga.
- Kad su svi parovi tačni, vježba javi „kraj" i stranica lekcije otključa dugme
  **Završi vježbu**. Na kraju piše vrijeme, koliko je bilo tačno **iz prve** i
  koliko puta je tražena pomoć.

## Kako napraviti novu vježbu (iz admin panela)

1. **Admin panel → Vježbe → Naše vježbe → Nova vježba** (kod „Spoji parove").
2. Upiši naslov.
3. Za svaki par upiši **pojam** lijevo i **odgovor** desno.
4. **Dodaj par** za svaki sljedeći (od dva do dvanaest).
5. **Sačuvaj** — ispod se odmah otvori pregled onakav kakvim ga dijete vidi.

Isti pojam ne smije se ponavljati, ni isti odgovor — dijete ne bi znalo šta ide
uz šta. Odgovore vježba pomiješa sama.

## Kako dodati novu vježbu kao datoteku uz kod

1. Napravi `artifacts/mekteb-arapsko-pismo/public/vjezbe/spoji/podaci/<ime>.json`
   (ime smije imati samo mala slova, cifre i crticu — to je ujedno ID vježbe).
2. Popuni je po uzoru na `pojmovi.json`:

   ```json
   {
     "id": "pojmovi",
     "naslov": "Spoji pojam i objašnjenje",
     "uputa": "Prevuci odgovor uz pojam kojem pripada.",
     "parovi": [
       { "lijevo": "ezan", "desno": "poziv na namaz" },
       { "lijevo": "sehur", "desno": "obrok prije zore" }
     ]
   }
   ```

   | polje | značenje |
   |---|---|
   | `id` | oznaka koja se vraća u događajima vježbe |
   | `naslov` | naslov iznad parova i naziv u admin spisku |
   | `uputa` | jedna-dvije rečenice (nije obavezno) |
   | `parovi` | `[{ "lijevo": "...", "desno": "..." }]`, od dva do dvanaest |
   | `poredaj` | `mijesaj` (zadano) ili `redom` za ponuđene odgovore |

3. Push na GitHub i redeploy u Coolifyju.
4. U lekciji otvori karticu **Vježbe** → **Dodaj našu vježbu**, odaberi vrstu
   *Spoji parove*, pa vježbu sa spiska, i odaberi kapi meda (0, 3, 5 ili 10).
5. Provjeri je u pregledniku:
   `node artifacts/mekteb-arapsko-pismo/scripts/provjeri-spoji.mjs`
   (prije toga `pnpm run build`).

## Kako je složeno

| Fajl | Uloga |
|---|---|
| `public/vjezbe/spoji/spoji.html` | cijela vježba: parovi, ponuda, prevlačenje, tastatura, događaji |
| `public/vjezbe/spoji/podaci/*.json` | sadržaj pojedine vježbe |
| `api-server/src/lib/nase-vjezbe.ts` | zajednički registar, provjera sadržaja, URL |
| `api-server/src/routes/nase-vjezbe.ts` | spisak, sadržaj vježbe za iframe i CRUD za uređivač |
| `src/pages/admin-nase-vjezbe.tsx` | uređivač u admin panelu (kartica „Naše vježbe") |
| `src/pages/ilmihal-lekcija.tsx` | admin forma, popup vježbe, otključavanje dugmeta |

Prilog se upisuje kao `kind="embed"` sa relativnim `external_url`, pa koristi
postojeći put nagrađivanja: `POST /api/content/embed/zavrseno` dodjeljuje kapi
meda **jednom po učeniku i vježbi** (tabela `embed_completions`). `stored_name`
nosi marker `spoji:<id>`.

Ostale naše vježbe rade po istom obrascu — vidi `docs/OSMOSMJERKA.md`,
`docs/POPUNI-PRAZNINU.md`, `docs/POREDAK.md` i `docs/RAZVRSTAJ.md`.

## Događaji koje vježba šalje roditeljskoj stranici

| Događaj | Kada | Polja |
|---|---|---|
| `visina` | promjena visine sadržaja | `visina` |
| `par` | par potvrđen kao tačan | `lijevo`, `desno`, `pronadjeno`, `ukupno` |
| `kraj` | svi parovi tačni | `id`, `pronadjeno`, `ukupno`, `sekunde`, `greske`, `pomoc`, `provjere`, `tacnoIzPrve` |

Svaka poruka nosi `izvor: "mekteb-igra"` i `igra: "spoji"`.
