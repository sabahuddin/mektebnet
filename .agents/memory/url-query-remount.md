---
name: URL query bez globalnog remounta
description: Query-only navigaciju rješavati reaktivno po stranici; ne uključivati search u globalni route key.
---

Wouter u ovoj aplikaciji prati pathname i query string odvojeno. Promjena samo query parametara (`tab`, `grupaId`, učenik ili filter) zato može ostaviti istu komponentu montiranom i zadržati prethodni izbor.

Globalni remount kompletnog route stabla po `pathname + search` nije siguran. Na produkcijskom `/admin` ekranu izazvao je ponavljani ciklus učitanih podataka i skeletona više puta u nekoliko sekundi.

**Why:** problem zastarjelog izbora mora se riješiti bez remountovanja cijele aktivne stranice, jer admin i drugi veliki ekrani pri mountu ponovo pokreću sve fetchere i prikazuju loading stanje.

**How to apply:** zadržati globalni route key samo na jeziku. Stranice koje zavise od query parametara koriste `useSearch()`, uključuju search u zavisnosti efekata i eksplicitno resetuju/validiraju lokalne ID-jeve kada se kontekst promijeni. Ne oslanjati se samo na `useLocation()` za query promjene.