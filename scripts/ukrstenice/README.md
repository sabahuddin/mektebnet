# Ukrštenice za mektebsku pouku

Generator ukrštenica (PDF radni list + rješenje) čiji su pojmovi izvedeni iz
ilmihal lekcija u `scripts/content-seed.json.gz`.

Svaki PDF ima dvije stranice:

1. **radni list** — prazna mreža, tragovi razvrstani na *Vodoravno* i *Uspravno*,
   uz broj slova u zagradi i prostor za ime učenika;
2. **rješenje** — popunjena mreža i spisak odgovora.

Logotip mekteb.net stoji u gornjem desnom uglu obje stranice i u podnožju.

## Upotreba

```bash
node scripts/ukrstenice/provjeri.mjs          # provjera baze pojmova
node scripts/ukrstenice/generate.mjs          # sve teme → scripts/ukrstenice/pdf/
node scripts/ukrstenice/generate.mjs 03-namaz # samo jedna tema
node scripts/ukrstenice/generate.mjs --seed 7 # drugi raspored istih pojmova
node scripts/ukrstenice/generate.mjs --html   # zadrži i međukorak u HTML-u
```

Za ispis PDF-a koristi se Chromium (`--headless --print-to-pdf`). Putanja se traži
u `CHROME_BIN`, zatim u `PLAYWRIGHT_BROWSERS_PATH` (podrazumijevano
`/opt/pw-browsers`), pa u `/usr/bin/chromium` i sličnim lokacijama.

Isti `--seed` uvijek daje isti raspored, pa se list može ponovo odštampati
neizmijenjen. Promjena seeda daje novu mrežu od istih pojmova — korisno kada
ista grupa treba drugu varijantu.

## Teme

Teme su u `teme.json`. Svaka ima naslov, nivo, spisak lekcija iz kojih je
izvedena i pojmove u obliku `{ "o": ODGOVOR, "t": "trag" }`.

| Tema | Nivo | Pojmova |
|------|------|---------|
| Prvi koraci u mektebu | 1 | 18 |
| Šarti — temelji naše vjere | 1 | 18 |
| Namaz | 2 | 20 |
| Iman — šest temelja vjerovanja | 3 | 16 |
| Allahova svojstva | 3 | 16 |
| Meleki i duhovna bića | 3 | 15 |
| Ahiret — budući svijet | 3 | 15 |
| Allahovi poslanici | 3 | 20 |
| Život Muhammeda, a.s. | 3 | 19 |
| Ramazan i mubarek dani | 2 | 17 |
| Lijep ahlak | 2 | 19 |
| Čistoća i vjerski propisi | 2 | 16 |

## Pravila za pisanje pojmova

- Odgovori se pišu velikim slovima, bez razmaka, crtica i apostrofa
  (`SUDNJI DAN` → `SUDNJIDAN`, `sahibi-uzur` → `SAHIBIUZUR`).
- Slova **Č, Ć, Ž, Š** i **Đ** zauzimaju jedno polje; **DŽ** se piše kao D + Ž,
  dakle dva polja — kao u klasičnim mektebskim ukrštenicama.
- Trag treba biti kratak i jednoznačan, pisan jezikom kojim je pisana lekcija.

## Provjere

`provjeri.mjs` traži svaki odgovor u tekstu lekcija navedenih uz temu. Poređenje
ide po korijenu riječi, pa prepoznaje i padeže (`DŽAMIJA` ~ *džamiji*,
`MEKKA` ~ *Mekke*), a višečlani odgovori traže se i kao spoj do tri uzastopne
riječi. Ako pojam nije nađen, ispisuje se u kojim ga lekcijama ima — pa se ili
ispravi odgovor ili u temu doda lekcija koja ga obrađuje. Time u ukrštenicu ne
može ući pojam kojeg u gradivu nema.

`generate.mjs` prije ispisa provjerava i samu mrežu: da se svaka riječ u njoj
čita tačno onako kako je zapisana i da nijedan niz od dva ili više susjednih
slova nije ostao bez svog traga. Ako provjera padne, PDF se ne pravi.

## Dodavanje nove teme

1. Odaberi lekcije i upiši njihove `slug`-ove u novu stavku u `teme.json`.
   Slugovi su isti kao u bazi (`ilmihal_lekcije.slug`).
2. Napiši 15–20 pojmova. Manje od 12 daje rijetku mrežu, više od 22 teško stane
   na jednu A4 stranicu.
3. Pokreni `provjeri.mjs` i popravi sve što nije potvrđeno.
4. Pokreni `generate.mjs <id-teme>` i pogledaj rezultat.

Ako neki pojam ostane izvan mreže (nema zajedničkog slova ni s jednom
smještenom riječju), generator ga navede na stranici s rješenjem i ispiše
upozorenje. Tada mu promijeni seed ili zamijeni pojam.
