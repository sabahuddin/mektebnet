---
name: Uske tabele prisustva
description: Provjera stvarne horizontalne širine responsivne tabele sa mnogo kratkih dugmadi.
---

Kod četiri časa sva dugmad mogu izgledati vidljiva, a tabela ipak imati nekoliko piksela horizontalnog pomjeranja zbog minimalne širine unutrašnjih dugmadi ili polja. Sama širina tabele nije dovoljna za procjenu.

**Why:** Vizuelna provjera je dvaput pokazala skoro cijeli četvrti čas, ali mjerenje `scrollWidth` naspram `clientWidth` je i dalje otkrivalo višak.

**How to apply:** Na desktopu mjeri `scrollWidth` i `clientWidth` i tabele i njenog scroll kontejnera. Za četiri kolone zadrži dovoljno prostora uz bočnu navigaciju i smanji intrinzičnu širinu kontrola; na mobilnom zadrži vodoravno pomjeranje.