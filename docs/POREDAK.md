# Poredak — naša vježba ispod lekcije

Treća vježba koju platforma servira sama, bez LearningAppsa, Wordwalla i H5P-a.
Dijete dobije izmiješane stavke i slaže ih u tačan redoslijed. **Novu vježbu
admin pravi sam, u panelu** — bez izmjene koda i bez deploya. Vježbe koje idu
uz kod i dalje mogu biti JSON datoteke u repozitoriju.

Vježba ne šalje nijedan zahtjev prema vanjskim domenama i ne postavlja kolačiće.
Font Nunito učitava se s našeg servera (`public/fonts/nunito-*.woff2`, SIL OFL).

## Kako dijete rješava

Svako pomjeranje je **zamjena mjesta dvije stavke** — tako stavke koje su već
potvrđene ostaju tačno tamo gdje jesu.

- **Mišem i prstom:** prevuče stavku na onu s kojom mijenja mjesto.
- **Bez prevlačenja:** dodirne jednu stavku (ona se označi), pa drugu.
- **Strelicama ▲▼** uz svaku stavku, i mišem i tastaturom.
- **Tastaturom:** Tab do stavke, Enter, pa Tab do druge stavke i Enter.
- Dok slaže, nema nijedne zelene ni crvene oznake. Kad misli da je gotovo,
  klikne **Provjeri**: stavke na svome mjestu pozelene i zaključaju se, ostale
  se označe crveno i slažu se dalje. Svaka stavka koja nije na svome mjestu
  broji se kao greška.
- **Pomozi mi** dovede na svoje mjesto prvu stavku koja tamo ne pripada.
- Kad je cijeli redoslijed tačan, vježba javi „kraj" i stranica lekcije otključa
  dugme **Završi vježbu**. Na kraju piše vrijeme, koliko je bilo na mjestu **iz
  prve** i koliko puta je tražena pomoć.

## Kako napraviti novu vježbu (iz admin panela)

1. **Admin panel → Vježbe → Naše vježbe → Nova vježba** (kod „Poredak").
2. Upiši naslov.
3. U polje **Stavke** upiši jednu stavku po redu, **tačnim redoslijedom** — od
   prve do zadnje. Vježba ih sama izmiješa pred djetetom.
4. **Sačuvaj** — ispod se odmah otvori pregled onakav kakvim ga dijete vidi.

Stavka može biti riječ, izraz ili cijela rečenica. Dvije iste stavke nisu
dozvoljene (dijete ih ne bi moglo razlikovati), najmanje su dvije, najviše
dvadeset.

## Kako dodati novu vježbu kao datoteku uz kod

1. Napravi `artifacts/mekteb-arapsko-pismo/public/vjezbe/poredak/podaci/<ime>.json`
   (ime smije imati samo mala slova, cifre i crticu — to je ujedno ID vježbe).
2. Popuni je po uzoru na `abdest-koraci.json`:

   ```json
   {
     "id": "abdest-koraci",
     "naslov": "Poredaj korake abdesta",
     "uputa": "Složi stavke od prve do zadnje, pa klikni „Provjeri\".",
     "stavke": ["Prouči Bismillu", "Operi šake tri puta", "Isperi usta tri puta"]
   }
   ```

   | polje | značenje |
   |---|---|
   | `id` | oznaka koja se vraća u događajima vježbe |
   | `naslov` | naslov iznad spiska i naziv u admin spisku |
   | `uputa` | jedna-dvije rečenice (nije obavezno) |
   | `stavke` | stavke **u tačnom redoslijedu** |
   | `poredaj` | `mijesaj` (zadano) ili `redom` (ne miješa — korisno pri provjeri) |

3. Push na GitHub i redeploy u Coolifyju.
4. U lekciji otvori karticu **Vježbe** → **Dodaj našu vježbu**, odaberi vrstu
   *Poredak*, pa vježbu sa spiska, i odaberi kapi meda (0, 3, 5 ili 10).
5. Provjeri je u pregledniku:
   `node artifacts/mekteb-arapsko-pismo/scripts/provjeri-poredak.mjs`
   (prije toga `pnpm run build`).

## Kako je složeno

| Fajl | Uloga |
|---|---|
| `public/vjezbe/poredak/poredak.html` | cijela vježba: spisak, zamjena mjesta, tastatura, događaji |
| `public/vjezbe/poredak/podaci/*.json` | sadržaj pojedine vježbe |
| `api-server/src/lib/nase-vjezbe.ts` | zajednički registar, provjera sadržaja, URL |
| `api-server/src/routes/nase-vjezbe.ts` | spisak, sadržaj vježbe za iframe i CRUD za uređivač |
| `src/pages/admin-nase-vjezbe.tsx` | uređivač u admin panelu (kartica „Naše vježbe") |
| `src/pages/ilmihal-lekcija.tsx` | admin forma, popup vježbe, otključavanje dugmeta |

Prilog se upisuje kao `kind="embed"` sa relativnim `external_url`, pa koristi
postojeći put nagrađivanja: `POST /api/content/embed/zavrseno` dodjeljuje kapi
meda **jednom po učeniku i vježbi** (tabela `embed_completions`). `stored_name`
nosi marker `poredak:<id>`.

Osmosmjerka i „Popuni prazninu" rade po istom obrascu — vidi `docs/OSMOSMJERKA.md`
i `docs/POPUNI-PRAZNINU.md`.

## Događaji koje vježba šalje roditeljskoj stranici

| Događaj | Kada | Polja |
|---|---|---|
| `visina` | promjena visine sadržaja | `visina` |
| `stavka` | stavka potvrđena na svome mjestu | `stavka`, `pronadjeno`, `ukupno` |
| `kraj` | cijeli redoslijed tačan | `id`, `pronadjeno`, `ukupno`, `sekunde`, `greske`, `pomoc`, `provjere`, `tacnoIzPrve` |

Svaka poruka nosi `izvor: "mekteb-igra"` i `igra: "poredak"`.

Četvrta naša vježba, „Razvrstaj", radi po istom obrascu — vidi `docs/RAZVRSTAJ.md`.
