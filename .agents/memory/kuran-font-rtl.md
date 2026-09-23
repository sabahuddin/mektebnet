---
name: Kur'an font i RTL navigacija
description: Koji font za Mushaf tekst i kako orijentisati prev/next u Kur'anu.
---

## Font: koristi islam.ba "hafs" font, ne generički Uthmanic subset
Za quran-uthmani tekst (api.alquran.cloud) generički/subsetovani Uthmanic woff2 NE iscrtava ispravno kur'anske anotacijske znakove — npr. ۟ (U+06DF, mala okrugla nula iznad "وا") ispadne kao velika crna tačka na liniji. Korisnik je to dva puta odbio.

**Rješenje:** skini font sa islam.ba: `https://www.islam.ba/fonts/hafs/hafs.woff2` (+ `hafs.otf` kao fallback), hostaj lokalno u `public/fonts/`, @font-face family ostaje `'UthmanicHafs'`. Taj font ispravno renderuje sve znakove.

**Why:** korisnik eksplicitno traži da izgleda kao islam.ba. Veličina fajla nije pokazatelj ispravnosti (islam.ba woff2 je manji ali ispravan).

## RTL navigacija u Kur'anu (prev/next)
Kur'an se čita zdesna nalijevo kao štampani Mushaf, pa: **Sljedeća = LIJEVO (← Sljedeća), Prethodna = DESNO (Prethodna →)** — suprotno od latiničnih knjiga. Vrijedi i za page mode i za prev/next sure.

**How to apply:** kad gradiš bilo koju prev/next kontrolu unutar Kur'ana, postavi "naprijed" dugme lijevo sa strelicom ←.

## Bismilla u prikazu po stranicama
Bismilla i naslov sure prikazuju se samo kad stranica sadrži **prvi ajet nove sure**, ne na vrhu svake stranice koja nastavlja istu suru. El-Fatiha ima bismillu kao prvi ajet, a Et-Tevba je nema.

**Why:** korisnik je ukazao da ponavljanje bismille i naslova sure na svakoj Mushaf stranici netačno predstavlja tekst i zauzima prostor za ajete.

**How to apply:** za oznaku početka sure gledaj broj ajeta unutar sure, ne prvi ajet učitan na stranici. Na stranici koja počinje usred sure odmah prikaži ajete.
