---
name: Zadaća kapi meda vs total_med
description: Koja kolona se inkrementira kad muallim dodijeli "kapi meda" pri pregledu zadaće
---

Kad muallim u pregledu zadaće dodijeli "Kapi meda" (0/10/20/30), inkrementira se `total_hasanat` (znanje), NE `total_med`.

**Why:** "Kapi meda" u UI-u (ucenik-profil.tsx) mapira na totalHasanat; "Aferimi" je total_med (samo igrice). Originalni session plan je rekao totalMed, ali to je pogrešno — verifikovano u kodu da Kapi meda = totalHasanat.

**How to apply:** Svaka muallim-dodijeljena nagrada za zadaću ide na total_hasanat preko raw SQL delta (delta = novo - staro da se izbjegne dupliranje pri ponovnom pregledu).
