# Razvrstaj — naša vježba ispod lekcije

Četvrta vježba koju platforma servira sama, bez LearningAppsa, Wordwalla i
H5P-a. Dijete razvrstava pojmove u dvije do pet kutija. **Novu vježbu admin
pravi sam, u panelu** — bez izmjene koda i bez deploya.

Vježba ne šalje nijedan zahtjev prema vanjskim domenama i ne postavlja kolačiće.
Font Nunito učitava se s našeg servera (`public/fonts/nunito-*.woff2`, SIL OFL).

## Kako dijete rješava

- **Mišem i prstom:** prevuče stavku iz ponude u kutiju; kutija ispod prsta
  posvijetli. Prevlačenjem nazad u ponudu stavka se vraća.
- **Bez prevlačenja:** dodirne stavku (ona se označi), pa dodirne kutiju.
- **Tastaturom:** Tab do stavke, Enter, pa Tab do kutije i Enter.
- **Svaka stavka se prihvata, i kad nije u pravoj kutiji.** Dok razvrstava, nema
  nijedne zelene ni crvene oznake. Dodirom na stavku u kutiji vraća je u ponudu.
- Uz naziv kutije stoji brojka „koliko je u njoj / koliko ih tu treba biti".
- Kad ponuda ostane prazna, otključa se dugme **Provjeri**: tačno razvrstane
  stavke pozelene i zaključaju se, ostale se označe crveno. Svaka stavka u
  pogrešnoj kutiji broji se kao greška.
- **Pomozi mi** smjesti jednu stavku u njenu kutiju i zaključa je.
- Kad je sve tačno, vježba javi „kraj" i stranica lekcije otključa dugme
  **Završi vježbu**. Na kraju piše vrijeme, koliko je bilo tačno **iz prve** i
  koliko puta je tražena pomoć.

## Kako napraviti novu vježbu (iz admin panela)

1. **Admin panel → Vježbe → Naše vježbe → Nova vježba** (kod „Razvrstaj").
2. Upiši naslov.
3. Za svaku kutiju upiši naziv i njene stavke — **jednu po redu**.
4. **Dodaj kutiju** ako trebaš treću, četvrtu ili petu (najviše pet).
5. **Sačuvaj** — ispod se odmah otvori pregled onakav kakvim ga dijete vidi.

Ista stavka ne smije stajati u dvije kutije (dijete ne bi znalo gdje ide).
Najviše je četrdeset stavki ukupno.

## Kako dodati novu vježbu kao datoteku uz kod

1. Napravi `artifacts/mekteb-arapsko-pismo/public/vjezbe/razvrstaj/podaci/<ime>.json`
   (ime smije imati samo mala slova, cifre i crticu — to je ujedno ID vježbe).
2. Popuni je po uzoru na `mjeseci.json`:

   ```json
   {
     "id": "mjeseci",
     "naslov": "Razvrstaj mjesece",
     "uputa": "Prevuci svaki mjesec u kutiju kojoj pripada.",
     "kategorije": [
       { "naziv": "Hidžretski mjeseci", "stavke": ["muharrem", "safer", "ramazan"] },
       { "naziv": "Mjeseci po Suncu", "stavke": ["januar", "april", "juli"] }
     ]
   }
   ```

   | polje | značenje |
   |---|---|
   | `id` | oznaka koja se vraća u događajima vježbe |
   | `naslov` | naslov iznad kutija i naziv u admin spisku |
   | `uputa` | jedna-dvije rečenice (nije obavezno) |
   | `kategorije` | od dvije do pet kutija, svaka sa `naziv` i `stavke` |
   | `poredaj` | `mijesaj` (zadano) ili `redom` za ponuđene stavke |

3. Push na GitHub i redeploy u Coolifyju.
4. U lekciji otvori karticu **Vježbe** → **Dodaj našu vježbu**, odaberi vrstu
   *Razvrstaj*, pa vježbu sa spiska, i odaberi kapi meda (0, 3, 5 ili 10).
5. Provjeri je u pregledniku:
   `node artifacts/mekteb-arapsko-pismo/scripts/provjeri-razvrstaj.mjs`
   (prije toga `pnpm run build`).

Za nazive i termine vrijedi transkripcija po Pravilima Rijaseta (vještina
`transkripcija-rijaset`) — npr. *muharrem, safer, redžeb, ramazan, ševval*.

## Kako je složeno

| Fajl | Uloga |
|---|---|
| `public/vjezbe/razvrstaj/razvrstaj.html` | cijela vježba: kutije, ponuda, prevlačenje, tastatura, događaji |
| `public/vjezbe/razvrstaj/podaci/*.json` | sadržaj pojedine vježbe |
| `api-server/src/lib/nase-vjezbe.ts` | zajednički registar, provjera sadržaja, URL |
| `api-server/src/routes/nase-vjezbe.ts` | spisak, sadržaj vježbe za iframe i CRUD za uređivač |
| `src/pages/admin-nase-vjezbe.tsx` | uređivač u admin panelu (kartica „Naše vježbe") |
| `src/pages/ilmihal-lekcija.tsx` | admin forma, popup vježbe, otključavanje dugmeta |

Prilog se upisuje kao `kind="embed"` sa relativnim `external_url`, pa koristi
postojeći put nagrađivanja: `POST /api/content/embed/zavrseno` dodjeljuje kapi
meda **jednom po učeniku i vježbi** (tabela `embed_completions`). `stored_name`
nosi marker `razvrstaj:<id>`.

Ostale naše vježbe rade po istom obrascu — vidi `docs/OSMOSMJERKA.md`,
`docs/POPUNI-PRAZNINU.md` i `docs/POREDAK.md`.

## Događaji koje vježba šalje roditeljskoj stranici

| Događaj | Kada | Polja |
|---|---|---|
| `visina` | promjena visine sadržaja | `visina` |
| `stavka` | stavka potvrđena u svojoj kutiji | `stavka`, `kutija`, `pronadjeno`, `ukupno` |
| `kraj` | sve tačno razvrstano | `id`, `pronadjeno`, `ukupno`, `sekunde`, `greske`, `pomoc`, `provjere`, `tacnoIzPrve` |

Svaka poruka nosi `izvor: "mekteb-igra"` i `igra: "razvrstaj"`.

Peta naša vježba, „Spoji parove", radi po istom obrascu — vidi `docs/SPOJI-PAROVE.md`.
