---
name: Scoped pregled muallima
description: Pravilo za pregled podataka drugog muallima iz glavnog muallimskog panela
---

Glavni muallim treba pregled drugog muallima otvoriti kroz eksplicitni read-only `muallimId` scope, a ne lažiranjem login identiteta.

**Why:** Tako isti panel može prikazati grupe, učenike, statistiku, kalendar, izvještaje i roditelje odabranog muallima, dok backend zadržava jasnu provjeru da je odabrani muallim iz istog mekteba i da se ništa ne može mijenjati iz previewa.

**How to apply:** Svaki novi endpoint koji se koristi u tom pregledu mora prihvatiti isti scope ili eksplicitno odbiti preview; frontend u read-only modu treba sakriti akcije koje mijenjaju podatke.