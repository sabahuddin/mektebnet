---
name: Hero kopije moraju biti WebP
description: Pravilo za sigurno uklanjanje bundlanih kopija slika lekcija.
---

Bundlana kopija hero slike smije se ukloniti tek kada je potvrđeno da svaka produkcijska referenca pokazuje na stvarno postojeći trajni fajl.

**Why:** Produkcijska baza može zadržati `/uploads/*.webp` ili staru `/edu/assets/images/*.webp` referencu iako fajl više ne postoji. Server tada može vratiti HTML fallback sa statusom 200, browser prijavi grešku slike i frontend završi na placeholderu.

**How to apply:** Prije brisanja stare slike provjeri produkcijski sadržaj svih lekcija i stvarni `Content-Type` svakog URL-a. Ne tretiraj HTTP 200 kao dokaz da je slika dostupna; odgovor mora biti `image/*`. Zadrži bundlanu WebP kopiju dok DB reference i trajni upload nisu potvrđeni.