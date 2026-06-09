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
`AI_INTEGRATIONS_OPENAI_BASE_URL`/`_API_KEY` (postavi `setupReplitAIIntegrations`),
plain `fetch` na `${BASE_URL}/chat/completions`, model gpt-5-mini, response_format
json_object. Idempotentno (prevodi samo nedostajuće), piše nakon svake grupe.
Bash ima 120s limit pa duži prijevod ide u više prolaza (`timeout 115 ... ` re-run).
Trošak prijevoda interfejsa je reda veličine centi (gpt-5-mini, kratki UI stringovi) —
tokeni nikad nisu faktor odluke; usko grlo je ljudski pregled.
