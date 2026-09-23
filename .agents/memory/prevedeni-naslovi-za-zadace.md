---
name: Prevedeni naslovi lekcija u zadaćama
description: U lokaliziranom pickeru prikazani naslov nije kanonska vrijednost za API validaciju.
---

Kod zadaće vezane za lekciju, prevedeni naslov služi samo za prikaz; uz slug
šalji izvorni naslov koji API vraća odvojeno od lokaliziranog naslova.

**Why:** muallim je na engleskom vidio prevedenu lekciju u izboru, ali je
kreiranje zadaće odbijeno jer je server upoređivao taj tekst sa bosanskim
naslovom u bazi. Na bosanskom je isto ponašanje izgledalo ispravno.

**How to apply:** za svaki lokalizirani izbor koji se čuva/validira pomoću
naslova ili sluga odvoji prikazni tekst od izvornog identiteta. Testiraj i
kreiranje i uređivanje, te sve ulaze u isti tok (glavni modul i kartica
učenika/grupe).