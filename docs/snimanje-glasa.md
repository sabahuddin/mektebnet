# Snimanje glasa za vježbe opismenjavanja

Ovo je postupak kojim se zvuk u vježbama pravi od sada. Zamjenjuje skupljanje
snimaka s tuđih stranica.

## Zašto se odustalo od preuzimanja

Tuđi snimci su se pokazali neupotrebljivim kao cjelina, iako je svaki
pojedinačno bio uredan:

- **Glas se mijenjao iz riječi u riječ.** U istoj vježbi jedna riječ ženskim,
  druga muškim glasom. Dijete to čuje kao dvije različite knjige.
- **Vokali su bili razvučeni.** Kod jednog učača izolovani slog „la" traje 0,75
  sekundi, a cijela dvosložna riječ „leben" 0,66. Dijete čuje dužinu tamo gdje
  je napisano kratko.
- **Padežni nastavci kojih u zapisu nema.** Snimak riječi `ماء` izgovara
  *ma'un*. Mi pišemo `ماء`, bez tenvina. Dijete vidi jedno, čuje drugo.
- **Ime datoteke ne kazuje šta je na snimku.** `Ar-علم.ogg` može biti *ilm*,
  *alem* ili *alime*. Bez slušanja se ne zna.

Sve četiri zamke nestaju kad jedan čovjek pročita cijeli spisak odjednom.

## Kako se piše spisak

Zadnji harf svakog zapisa nosi vokal, tenvin, sukun ili tešdid — `مَالْ`, ne
`مال`. Pravilo je opisano u `CLAUDE.md`; skripta ga ne provjerava, ali test
`zavrsetak-zapisa.test.ts` pada čim takav zapis uđe u vježbu.

Za snimanje vlastitim glasom to nije pitanje sintetizatora nego tvoje:
zapis kaže tebi kako da pročitaš. Ako piše `كَانَ`, čitaš *kane*; ako piše
`كَانْ`, čitaš *kan*.

## Kako se snima

1. **Dogovori se spisak prije snimanja.** Koje riječi, kojim redom. Spisak je
   obična tekstualna datoteka, jedan zapis po redu, s harekama onako kako stoji
   u vježbi. Redovi koji počinju s `#` se preskaču.
2. **Čitaj redom sa spiska**, jednu riječ po jednu.
3. **Između svake dvije zastani najmanje pola sekunde.** Pauza je jedino po
   čemu se snimak siječe. Kraća pauza spoji dvije riječi u jednu datoteku.
4. **Ostavi sekundu tišine na početku i na kraju.**
5. **Ne mijenjaj udaljenost od mikrofona** usred snimanja.
6. **Kratak slog čitaj kratko.** `بَ` je *be*, ne *beee*. Skripta odbija svaki
   harf s harekom koji traje duže od 0,45 sekundi.

Format nije bitan — m4a s telefona je sasvim dovoljan.

## Kako se obrađuje

```
node artifacts/mekteb-arapsko-pismo/scripts/isijeci-snimak.mjs snimak.m4a spisak.txt
```

Bez zastavice ništa se ne upisuje. Skripta nađe granice, prebroji riječi i
ispiše šta bi uradila. Kad je sve na broju:

```
node artifacts/mekteb-arapsko-pismo/scripts/isijeci-snimak.mjs snimak.m4a spisak.txt --primijeni
```

Tada se svaka riječ izreže u zasebnu MP3 datoteku u
`public/audio/opismenjavanje/` i poveže s odgovarajućom stavkom u
`public/vjezbe/slusaj/podaci/*.json`.

### Šta skripta radi sa zvukom

- **Podiže visinu glasa na 115 Hz.** Muški glas je oko 105 Hz, a snimke sluša
  dijete od pet godina. Pomjeraju se ton i formanti zajedno, običnim
  presempliranjem — nema metalnog prizvuka koji ostavljaju fazni postupci.
  Trajanje se vraća na izvorno, pa se govor ne ubrzava.
  Sa `--hz 0` se visina ne dira.
- **Izjednačava jačinu** na −18 LUFS, da nijedna riječ ne bude glasnija od
  ostalih.
- **Pretvara u mono 44,1 kHz, 96 kb/s MP3** — isti format koji koristi ostatak
  zbirke.

### Šta skripta odbija

- kratak slog (harf s harekom, bez dužine) duži od 0,45 s
- bilo šta kraće od 0,1 s ili duže od 3 s
- isječak čija visina odstupa od ciljane za više od 25 Hz

Odbijeno se i dalje napravi, ali se prijavi i skripta izađe s greškom, da se
ne provuče nezapaženo.

### Kad se broj dionica ne poklapa sa spiskom

Skripta stane i ispiše granice uz riječi, da se vidi gdje se razišlo.

- **Dvije riječi su spojene** → pauza je bila prekratka. Povisi `--pauza` ili
  snizi prag: `--prag -40`.
- **Jedna riječ je isječena na dvije** → u njoj je bila pauza. Snizi `--pauza`.
- **Ima jedna dionica viška na početku** → škljocaj snimača. Dionice kraće od
  0,25 s se već odbacuju same; ako je duža, povisi `--najkraca`.

## Zastavice

| zastavica | zadano | šta radi |
|---|---|---|
| `--primijeni` | — | bez nje se ništa ne upisuje |
| `--hz` | 115 | ciljana visina glasa; `0` ne dira ništa |
| `--prag` | −35 | ispod koliko dB se broji kao tišina |
| `--pauza` | 0,25 | koliko tišine dijeli dvije riječi |
| `--najkraca` | 0,25 | kraće dionice se odbacuju kao šum |
| `--rub` | 0,06 | koliko se ostavi sa svake strane riječi |
