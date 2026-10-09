---
name: Administratorski pregled igrica
description: Zašto admin pristup igricama ostaje odvojen od učeničke ekonomije.
---

Admin može vidjeti i isprobati sve igrice bez prethodnog zarađivanja učeničkog vremena. Pregled ne donosi učeničke nagrade niti uključuje admina u učeničko takmičenje. Ostale odrasle uloge ne dobijaju ovaj pristup.

**Why:** Korisnik je tražio da admin može vidjeti igrice. Pristup služi provjeri sadržaja, ne zaobilaženju učeničkih pravila ili utjecanju na njihove rezultate.

**How to apply:** Pri dodavanju novih igrica pokrij administratorski pristup i na stranici i na svim pripadajućim API rutama; prava provjeravaj po autentificiranoj ulozi, ne po klijentskoj oznaci pregleda.
