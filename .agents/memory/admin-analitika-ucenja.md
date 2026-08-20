---
name: Admin analitika učenja
description: Pravilo za metrike i rang-liste u admin analitici Mekteba.
---

## Pravilo

Admin analitika treba prikazivati isključivo mjerljive aktivnosti prijavljenih
korisnika: prijave, napredak kroz lekcije, završetke i rezultate kvizova. Ne
koristiti anonimne HTTP posjete kao pokazatelj korištenja platforme.

**Why:** Javne posjete uključuju botove, crawlere, indekse i zahtjeve bez
identiteta korisnika. Takvi podaci pogrešno pokazuju države i URL-ove poput
početne stranice ili prijave kao najvažniji sadržaj.

**How to apply:** Za rang-listu lekcija koristi evidentirani napredak učenika,
a za rang-listu kvizova rezultate pokušaja, uvijek unutar adminovog odabranog
perioda. Ako se kasnije uvodi geografska analitika, veži je uz provjerenu
prijavljenu sesiju, ne uz javni zahtjev.