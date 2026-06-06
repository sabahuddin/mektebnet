---
name: Poređenje arapskog teksta (Uthmani)
description: Zašto egzaktno poređenje arapskih stringova zakaže i kako pouzdano uklanjati prefikse (npr. bismilla).
---

# Poređenje arapskog teksta

Izvor `alquran.cloud` (endpoint `quran-uthmani`) NE garantuje kanonski redoslijed
kombinujućih znakova (harakata). Npr. u istoj riječi shadda (U+0651) može doći
prije ili poslije fethe (U+064E). Zbog toga `string.startsWith(BISMILLAH)` ili bilo
koje egzaktno poređenje arapskih stringova nepouzdano zakaže iako tekst "izgleda isto".

**Pravilo:** nikad ne poredi arapske stringove egzaktno. Normalizuj prije poređenja:
- skini sve harakate/oznake: `[\u064B-\u065F\u0670\u0610-\u061A\u06D6-\u06ED\u0640]`
- izjednači varijante alifa: `[\u0622\u0623\u0625\u0671] -> \u0627`
- ukloni razmake

**How to apply:** za uklanjanje bismille s početka prvog ajeta — normalizuj prve 4
razmakom-odvojene riječi i uporedi sa normalizovanom bismillom; ako se poklapaju,
odsiječi prve 4 tokena iz ORIGINALNOG (nenormalizovanog) teksta. Sure bez
bismilla-zaglavlja: 1 (bismilla JE ajet 1) i 9 (nema je). Vidi `lib/quran.ts`.
