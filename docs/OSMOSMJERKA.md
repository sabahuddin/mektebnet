# Osmosmjerka — naša vježba ispod lekcije

Osmosmjerka je prva vježba koju platforma servira sama, bez LearningAppsa,
Wordwalla i H5P-a. Jedan statički HTML fajl čita sadržaj iz JSON datoteke:
**nova osmosmjerka znači samo novu JSON datoteku**, bez ijedne izmjene koda.

Igra ne šalje nijedan zahtjev prema vanjskim domenama i ne postavlja kolačiće.
Font Nunito učitava se s našeg servera (`public/fonts/nunito-*.woff2`, SIL OFL).

## Kako dodati novu osmosmjerku (5 koraka)

1. Napravi datoteku `artifacts/mekteb-arapsko-pismo/public/vjezbe/osmosmjerka/podaci/<ime>.json`
   (ime smije imati samo mala slova, cifre i crticu — to je ujedno ID vježbe).
2. Popuni je po uzoru na `ramazan.json`:

   ```json
   {
     "id": "ramazan-01",
     "naslov": "Ramazan",
     "uputa": "Pročitaj opis, pogodi riječ, pa je pronađi u mreži.",
     "velicina": 10,
     "tezina": "srednje",
     "prikaz": "opisi",
     "dvoslovi": true,
     "rijeci": [
       { "rijec": "sehur", "opis": "Obrok prije zore." }
     ]
   }
   ```

   | polje | značenje |
   |---|---|
   | `id` | oznaka koja se vraća u događajima igre |
   | `naslov` | naslov iznad mreže i naziv u admin spisku |
   | `uputa` | jedna-dvije rečenice (nije obavezno) |
   | `velicina` | broj polja po stranici, 8–14 (mreža sama naraste ako riječi ne stanu) |
   | `tezina` | `lako` (desno i dolje), `srednje` (i ukoso), `tesko` (svih osam smjerova) |
   | `prikaz` | `rijeci` ili `opisi` (dijete vidi opis, a riječ mora pogoditi) |
   | `dvoslovi` | `true`: DŽ, LJ i NJ stoje u jednom polju; razdvoji ih crtom kad nisu jedan glas: `"in\|jekcija"` |
   | `rijeci` | `[{ "rijec": "...", "opis": "..." }]` ili samo `["namaz", "ezan"]` |

   Apostrofi, razmaci i crtice ne ulaze u mrežu, pa `Kur'an` postaje `KURAN`.
   Za opise i nazive vrijedi transkripcija po Pravilima Rijaseta.
3. Push na GitHub i redeploy u Coolifyju (spisak se čita s diska pri svakom
   pozivu, pa nema migracije ni unosa u bazu).
4. U lekciji otvori karticu **Vježbe** → **Dodaj našu vježbu**, odaberi
   osmosmjerku sa spiska, po želji promijeni naziv i odaberi kapi meda
   (0, 3, 5 ili 10 — ista skala kao za embed vježbe) i spasi.
5. Provjeri je u pregledniku:
   `node artifacts/mekteb-arapsko-pismo/scripts/provjeri-osmosmjerku.mjs`
   (prije toga `pnpm run build`; u skripti promijeni `PODACI` na novu datoteku).

Muallim može dodati vježbu, ali ona čeka odobrenje admina — isto pravilo kao
za embed vježbe.

## Kako je složeno

| Fajl | Uloga |
|---|---|
| `public/vjezbe/osmosmjerka/osmosmjerka.html` | cijela igra: mreža, potezi, tastatura, događaji |
| `public/vjezbe/osmosmjerka/podaci/*.json` | sadržaj pojedine osmosmjerke |
| `public/fonts/nunito-latin*.woff2` | font platforme, lokalno (bez Google Fontsa) |
| `api-server/src/lib/osmosmjerke.ts` | čitanje foldera s podacima, provjera ID-a, URL vježbe |
| `api-server/src/routes/osmosmjerke.ts` | `GET /api/osmosmjerke` — spisak za admin formu |
| `api-server/src/routes/admin.ts` | `POST /api/admin/prilozi/:lekcijaId/osmosmjerka` |
| `src/pages/ilmihal-lekcija.tsx` | admin forma, popup vježbe, otključavanje dugmeta |

Prilog se upisuje kao `kind="embed"` sa relativnim `external_url`, pa koristi
postojeći put nagrađivanja: `POST /api/content/embed/zavrseno` dodjeljuje kapi
meda **jednom po učeniku i vježbi** (tabela `embed_completions`). Razlika u
odnosu na vanjske embede: `stored_name` nosi marker `osmosmjerka:<id>`, a igra
porukom `kraj` (provjeravaju se `origin` i `source`) otključava dugme
„Završi vježbu" — vanjska vježba to ne može javiti, pa tamo dugme stoji
otključano od početka. Poruka ne nosi nagradu; nagradu i dalje određuje server.

## Događaji koje igra šalje roditeljskoj stranici

| Događaj | Kada | Polja |
|---|---|---|
| `visina` | promjena visine sadržaja | `visina` |
| `rijec` | pronađena jedna riječ | `rijec`, `pronadjeno`, `ukupno` |
| `kraj` | pronađene sve riječi | `id`, `pronadjeno`, `ukupno`, `sekunde`, `pomoc`, `tezina`, `prikaz` |

Svaka poruka nosi `izvor: "mekteb-igra"` i `igra: "osmosmjerka"`.
