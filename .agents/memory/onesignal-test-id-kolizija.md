---
name: OneSignal testni ID-ovi
description: Rizik stvarne dostave push poruka iz integracijskih testova.
---

Razvojni i produkcijski numerički ID-ovi korisnika mogu se poklopiti, dok OneSignal prima te brojeve kao globalne `external_id` alias-e. Testni učenik u razvojnoj bazi stoga nije garantovano izolovan od stvarnog push primaoca.

**Why:** Tokom jednog testa testne zadaće OneSignal je prijavio uspješne odgovore sa primaocima prije nego što je slanje za testni proces onemogućeno. Ne postoji siguran način da se već poslani push povuče.

**How to apply:** Svaki novi put za masovni push smije zvati OneSignal samo u produkcijskom režimu, ne samo uz isključen testni režim. Provjeri zaštitu prije PRVOG integracijskog testa: test runner se može pokrenuti bez `NODE_ENV=test`, a razvojna baza dijeli numeričke ID-jeve sa stvarnim uređajima. Testiraj in-app stanje i odabir adresata bez vanjskog slanja.