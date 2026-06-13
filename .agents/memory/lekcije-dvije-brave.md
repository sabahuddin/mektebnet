---
name: Otključavanje lekcija — dvije odvojene brave
description: Zašto se "12. lekcija ne otvara" iako mapa pokaže otključano; mapa i stranica lekcije imaju nezavisne gate-ove koji moraju biti usklađeni.
---

# Otključavanje lekcija ima DVIJE nezavisne brave

Pristup ilmihal-lekciji kontrolišu DVA odvojena gate-a koja ne dijele logiku:

1. **Mapa** (`nivo1-mapa.tsx`): otključava lekcije u blokovima po 10. Sljedećih 10 se
   otvori kad je etapa-medaljon "položena" (`isEtapaPassed`). Pošto Nivo-1 medaljoni
   imaju `imaKviz=false` + `isGating=true`, etapa se AUTO-prolazi čim
   `completedCount >= posAfterRedoslijed`. Mapa ISPRAVNO prikaže sljedeću lekciju otključanom.
2. **Stranica lekcije** (`ilmihal-lekcija.tsx`, gate u GET `/content/ilmihal/:slug` `.then`):
   za ulogu `ucenik` TVRDO blokira svaku lekciju s `redoslijed > 10` (`limit = !user ? 5 : 10`),
   BEZ provjere napretka ili osvojenih medaljona. Redirect uz "Završi prethodne lekcije".

**Simptom "završi 11, ne otvara se 12":** uvodna lekcija je `redoslijed=0`, pa `r <= 10`
obuhvata 11 lekcija (r=0..10) koje učenik može otvoriti. 12. lekcija je `redoslijed=11`
(Nivo 1 = "selam") → `r=11 > 10` → stranica lekcije je vrati nazad iako je mapa pokazuje
otključanom. Nekonzistentnost između dvije brave; gate na stranici je zaostali tvrdi limit.

**Why:** Gate na stranici lekcije pisan je za zaštitu direktnog URL pristupa, ali nikad
ne konsultuje medaljon-blok logiku mape. Komentar u kodu kaže "dalje otključavanje ide kroz
mapu", ali gate to ne implementira — samo tvrdo reže `r > 10`.

**Riješeno:** Unlock logika je izdvojena u `src/lib/lekcija-unlock.ts`
(`computeUnlockedCellCount` + `isEtapaPassed`) i koriste je OBA gate-a. Stranica lekcije
sada dohvati `/mapa/nivo/:nivo`, nađe indeks lekcije u nizu i blokira samo ako je
`idx >= unlockedCellCount` (umjesto starog tvrdog `redoslijed <= 10`). Ovo i poravnava
gosta na prvih 5 i učenika na prvih 10 (kao mapa), uz konzervativni fallback na stari
limit ako `/mapa` zahtjev padne.

**How to apply:** NE vraćaj tvrdi `redoslijed`-limit u stranicu lekcije. Sve promjene
logike otključavanja idu u `src/lib/lekcija-unlock.ts` da oba gate-a ostanu identična.

**Sporedno (nije glavni uzrok 11/12):** lekcija se broji kao završena tek nakon strogog
anti-cheat gate-a (≥300s aktivnog čitanja; 30s za intro slugove; ≥85% skrol; otvorene sve
sekcije; i mini-kviz "Provjeri znanje" tačno riješen — SVE prve Nivo-1 lekcije imaju kviz).
Zato `completedCount` lako zaostaje za onim što učenik misli da je "uradio".
