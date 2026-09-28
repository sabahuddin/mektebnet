---
name: iPad horizontalno pomjeranje
description: Zašto body overflow-x:hidden nije dovoljan protiv pomjeranja cijele stranice na iPadu.
---

Na iPadu cijela stranica može elastično kliziti lijevo-desno i kada `body` ima `overflow-x:hidden`; korijenski `html` i preširoka desktop navigacija još uvijek mogu dopustiti pomjeranje viewporta. Zaključaj horizontalni overflow na `html` i `body` bez blokiranja vertikalnog scrolla, a gustu navigaciju zamijeni menijem prije tablet-landscape širine.

**Why:** U muallimskom prikazu poruka korisnik je mogao povući cijelu stranicu tako da se sadržaj odsiječe i ostane prazan prostor sa strane. Samo `body overflow-x:hidden` to nije spriječio.

**How to apply:** Kad se pojavi vodoravno klizanje cijele stranice na tabletu, prvo izmjeri `documentElement` i `body` širinu, provjeri intrinzičnu širinu zaglavlja i zaključa korijenski horizontalni pomak; nemoj globalnim `touch-action:pan-y` onemogućiti namjerne unutrašnje horizontalne scroller-e poput tabela.