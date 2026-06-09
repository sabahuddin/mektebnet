---
name: Admin editor prijevoda (live override)
description: Kako se prijevodi sada ispravljaju bez diranja koda — runtime override sloj umjesto editovanja locales/*.json
---

Postoji admin ekran `/admin/prijevodi` gdje admin uređuje BILO KOJI prijevod uživo:
- UI prijevodi (interfejs): runtime override sloj nad bundlanim `locales/*.json`. Override se čuva u tabeli `ui_prijevodi(jezik,kljuc,prijevod)`, servira javno na `/content/ui-prijevodi`, a `t()` u `language.tsx` provjerava override PRVO (`ov[key] || ov[bsValue]`) pa tek onda bundlane mape. Ključ override-a = bosanski izvorni tekst.
- Sadržajni prijevodi (iz baze): pretraga/uređivanje redova `content_prijevodi` preko `/admin/prijevodi/content` (pretraga param je `lang`, ne `jezik`).

**Why:** Korisnik ne želi code+push+redeploy ciklus za svaku tipfeler ispravku prijevoda. Override pregazi build-time vrijednost odmah nakon spremanja.

**How to apply:** Za ispravku pogrešnog prijevoda NE edituj `locales/*.json` niti kod — uputi korisnika (ili sam koristi rutu) na `/admin/prijevodi`. Kod mijenjaj samo za nove ključeve koji još ne postoje u flat locale mapama.
