---
name: Muallimovo uređivanje lekcija
description: Pravilo pojedinačne dozvole za izmjenu lekcija i nastavničkih materijala.
---

Admin može svakom muallimu pojedinačno uključiti ili isključiti uređivanje lekcija i nastavničkih materijala. Postojeći muallimi podrazumijevano zadržavaju pravo uređivanja. Kad se pravo isključi, muallim i dalje vidi Pripreme za nastavu i Materijale za nastavu te smije otvarati/prikazivati materijale, ali ne smije kreirati ni mijenjati lekcije ili priloge.

**Why:** Ograničenje treba pretvoriti uređivača u korisnika postojećeg nastavnog sadržaja, ne uskratiti mu uvid u sadržaj koji koristi tokom nastave.

**How to apply:** Poštuj dozvolu i na korisničkim kontrolama i na serverskim mutacijama. Čitanje/download ne blokiraj, a odluku o pisanju donosi prema ažurnoj dozvoli i važećoj ulozi, ne samo prema starom login tokenu.