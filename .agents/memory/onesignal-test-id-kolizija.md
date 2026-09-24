---
name: OneSignal testni ID-ovi
description: Rizik stvarne dostave push poruka iz integracijskih testova.
---

Razvojni i produkcijski numerički ID-ovi korisnika mogu se poklopiti, dok OneSignal prima te brojeve kao globalne `external_id` alias-e. Testni učenik u razvojnoj bazi stoga nije garantovano izolovan od stvarnog push primaoca.

**Why:** Tokom jednog testa testne zadaće OneSignal je prijavio uspješne odgovore sa primaocima prije nego što je slanje za testni proces onemogućeno. Ne postoji siguran način da se već poslani push povuče.

**How to apply:** Svaki test koji može pokrenuti notifikacije mora raditi s isključenim vanjskim slanjem prije prvog pokretanja. Samo odvojena testna baza nije dovoljna; testiraj payload/odabir adresata bez pozivanja zajedničkog OneSignal servisa.