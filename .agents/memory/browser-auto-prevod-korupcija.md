---
name: Auto-prevod preglednika kvari sadržaj (lang="en")
description: Misteriozni "pogrešni" tekst u kvizovima koji ne postoji u bazi = browser auto-translate
---

Simptom: korisnik prijavi da učenici vide "pogrešna" pitanja (npr. "Koje golubove učimo?" sa odgovorima "Rabin Jessir", "Hasbi rabin", "Allahu rabi"), a admin taj tekst NIGDJE ne nalazi — ni u `pitanja_banka`, ni u `content_prijevodi`. Pretraga prod baze za tim stringovima vraća 0.

Uzrok: AUTO-PREVOD PREGLEDNIKA (Chrome/Edge/Samsung Internet). `index.html` je imao `<html lang="en">` iako je sav sadržaj bosanski. Preglednik (npr. njemački/dijaspora) vidi "engleski" → ponudi/automatski prevede stranicu na korisnikov jezik. Kako je tekst već bosanski, prevodilac promijeni samo riječi koje liče na engleski: bosansko "dove" (dove=duas) → englesko "doves" → "golubove"; "Rabbi" → "Rabin". Pitanja stižu preko API-ja nakon mounta pa ih prevodilac dira kako se ubacuju u DOM.

Runtime kod (`context/language.tsx`) JESTE postavljao `document.documentElement.lang = lang`, ali tek nakon React mounta — početni statički `lang="en"` je dovoljan da preglednik pokrene prevod.

**Why:** App ima VLASTITI server-side sistem prijevoda (`content_prijevodi` + `ui_prijevodi` + bundlani locales) — browser auto-prevod ga ne treba i samo kvari pažljivo pisane islamske/arapske termine.

**How to apply:** `index.html` mora imati `<html lang="bs" translate="no">` + `<meta name="google" content="notranslate">`. Ako se tekst pojavljuje na ekranu a NE postoji u bazi → posumnjaj na auto-prevod preglednika, ne na korupciju podataka. Ne diraj bazu.
