# H5P šabloni — Mekteb.net

Ovaj direktorij sadrži .h5p starter šablone koje muallimi mogu preuzeti, otvoriti u
[Lumi Education](https://lumi.education/) desktop aplikaciji, zamijeniti tekst/slike
svojim sadržajem i ponovo eksportovati u .h5p za upload u Mekteb.

## Trenutni šabloni

| Fajl | Tip (mainLibrary) | Tema |
| --- | --- | --- |
| `harfovi-drag-the-words.h5p` | H5P.DragText | Spoji harf sa imenom (elif, ba, ta…) |
| `ilmihal-sartovi-imana.h5p` | H5P.MultiChoice | Šartovi imana — primjer pitanja |
| `vakat-namaza-pairs.h5p` | H5P.MultiChoice | Vakat namaza — primjer pitanja |
| `dijelovi-dzamije-hotspots.h5p` | H5P.MultiChoice | Dijelovi džamije — primjer pitanja |
| `harf-izgovor-memory.h5p` | H5P.DragText | Harf↔izgovor parovi |

Šabloni su **content-only** .h5p paketi (sadrže `h5p.json` + `content/content.json`).
Lumi automatski preuzima nedostajuće H5P biblioteke iz H5P-Hub-a kad otvori paket
prvi put — radi out-of-the-box. Korisnik samo mijenja tekst i može odmah
sačuvati novi .h5p za upload.

> **Napomena**: trenutno isporučujemo samo `H5P.DragText` i `H5P.MultiChoice`
> šablone jer su ti tipovi najjednostavniji za uređivanje teksta. Ostali tipovi
> sa tabele "Preporučeni tipovi" (Image Hotspots, Memory Game, Image Pair) su
> dostupni u Lumi-ju i muallim ih može sam kreirati po istom postupku
> opisanom u uputstvu.

Stranica `/muallim/h5p-uputstvo` pokazuje sve šablone — ako fajl postoji, dugme je
**"Preuzmi šablon"**, ako ne postoji, **"Šablon dolazi uskoro"** (HEAD provjera).

## Kako dodati novi šablon (za admin/maintainer-a)

### Brzi put — generator skripta

Postoji generator skripta `tools/generate-h5p-templates.mjs` u
`artifacts/mekteb-arapsko-pismo/`. Dodaj novi unos u `TEMPLATES` listu i pokreni:

```bash
node artifacts/mekteb-arapsko-pismo/tools/generate-h5p-templates.mjs
```

### Ručno (preporučeno za bogatije šablone)

1. Otvori Lumi Education na računaru.
2. Napravi novu H5P vježbu željenog tipa (npr. Drag the Words, Multiple Choice, Image Pairs).
3. Popuni je generičkim primjerom koji muallim može lahko izmijeniti.
4. Klikni "Save as .h5p" i sačuvaj fajl pod imenom koje stranica `h5p-uputstvo.tsx`
   referencira (vidi konstantu `H5P_TEMPLATES`).
5. Stavi fajl u ovaj direktorij i commit-aj.
6. Stranica će automatski pokazati dugme "Preuzmi" umjesto "Uskoro".

## Sigurnost

Ovi fajlovi su javno preuzimljivi (servirani su preko Vite static handler-a kao i
ostatak `public/`). Ne stavljaj ovdje ništa što sadrži lične podatke učenika ili
osjetljiv sadržaj.
