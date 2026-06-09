---
name: i18n višejezičnost (interfejs)
description: Kako radi prevodni sloj interfejsa (BS izvor + SQ/DE/EN/TR/AR) i OpenAI pipeline.
---

# Prevodni sloj interfejsa

Bosanski je IZVOR. Multi-jezik je nekad bio isključen (Google Translate je davao
neuredan rezultat); sad je pravi i18n s ručnim ključevima + OpenAI prijevodom.

## Arhitektura (dvojni lookup u `context/language.tsx` `t()`)
1. Bosanski izvor: `getNestedValue(translations.bs, key)` — `key` je ili dotted
   ključ (npr. `nav.pocetna`) ILI sam bosanski tekst (npr. `t("Dodaj učenika")`).
2. Flat rječnik za jezik: `src/locales/<lang>.json` — ravni map gdje je ključ
   dotted ključ ILI bosanski izvorni tekst, vrijednost = prijevod.
3. Postojeća ručna nested struktura `translations[lang]` u `i18n.ts` (de/en/tr/ar
   imaju ~188 ključeva; **sq NEMA** nested — sq dolazi samo kroz flat json).
4. Fallback = bosanski izvor.

**Why:** retrofit i18n u app s ~1500 hardkodiranih stringova bez izmišljanja 1500
dotted ključeva; bosanski izvor je istovremeno i fallback (ništa se ne "izgubi").

**How to apply:** novi UI tekst omotaj s `t("Bosanski tekst")`. Pokreni pipeline da
generiše prijevode. Dodavanje jezika = samo novi `src/locales/<lang>.json` + unos u
`Lang`, `LANG_LABELS`, `LANG_NAMES`, `COUNTRY_TO_LANG`, `LANG_ORDER` (layout.tsx).

## Default jezik
Default je **bs**; drugi jezik samo ručnim izborom u prekidaču (pamti se u
localStorage `mekteb-lang`). NE koristi `navigator.language` — prebacivalo bi bosansku
dijasporu (engleski browser) na strani jezik bez njihove odluke.

## OpenAI pipeline
`scripts/translate-i18n.ts` (tsx). Koristi Replit AI Integrations proxy preko
`AI_INTEGRATIONS_OPENAI_BASE_URL`/`_API_KEY`, plain `fetch` na
`${BASE_URL}/chat/completions`, response_format json_object. Idempotentno (prevodi
samo nedostajuće), inkrementalni (debounced) zapis na disk → resumable.

**Brzina (VAŽNO):** default model je `gpt-5-nano` s `reasoning_effort:"minimal"`
(gpt-5-mini je bio ~115s po chunku od 60 = nepraktično). Skripta paralelizuje preko
pool-a radnika (`--concurrency`, default 10) sa SVIM jezicima u jednom redu poslova.
Retry s eksponencijalnim backoffom na 429/5xx. CLI: `--langs sq,de,en,tr,ar
--chunk N --concurrency N [--dry]`. Pri puno paralelnih zahtjeva 429 se javlja —
drži konkurentnost ~5-6 za stabilno. Bash 120s limit pa duži posao ide u više
`timeout 115 ...` prolaza (resumable, samo re-run).

**Matching gotcha:** model zna SPOJITI fragmente koji u JSON nizu izgledaju kao jedna
rečenica isprekidana `","` (npr. tekst razbijen oko inline `<code>`), pa vrati jedan
kombinovani ključ. Merge je zato tolerantan: pokušaj egzaktni → pa normalizovani
(trim + collapse razmaka, uz očuvanje vodećih/pratećih razmaka). Tvrdokorne fragmente
popuni `--chunk 1` prolazom (jedan string po zahtjevu, nema spajanja).

Trošak je reda veličine centi (kratki UI stringovi); usko grlo je ljudski pregled, ne tokeni.
