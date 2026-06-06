---
name: Naslovna ima zaseban spisak modula
description: MODULES niz na home.tsx je odvojen od nav-a u layout.tsx; novi modul treba dodati na oba mjesta
---
Naslovna strana (src/pages/home.tsx) ima vlastiti hardkodiran `MODULES` niz kartica,
potpuno odvojen od glavne navigacije u `src/components/layout.tsx`.

**Why:** Kur'an je bio dodan u nav i kao ruta, ali je ostao izostavljen sa naslovne
jer su to dva nezavisna spiska — korisnik je to primijetio.

**How to apply:** Kad dodaješ/uklanjaš javni modul, ažuriraj OBA: nav u layout.tsx
i MODULES u home.tsx. Kur'an kartica na home je hardkodirana na bosanskom (bez i18n
ključa), isto kao nav label "Kur'an" — jer kuran nema prijevodne ključeve u i18n.ts.
