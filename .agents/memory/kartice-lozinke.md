---
name: Kartice — standardna lozinka, print je pure-read
description: Kako se izvode lozinke učenika/roditelja; print SAMO prikazuje, samo reset upisuje standardnu šifru
---

Standardna lozinka učenika/roditelja je `Mekteb<NNNN>`, gdje je `NNNN` brojčani sufiks iz korisničkog imena (imena su oblika `ime.NNNN`). Učenik i roditelj kreirani ZAJEDNO (bulk) dijele isti sufiks → istu lozinku. Bulk-create već generiše `Mekteb<sufiks>` kao početnu lozinku (par retry-ja sa NOVIM shared sufiksom na username koliziju).

Helper `passwordFromUsername(username, userId)`: regex `/\.(\d{3,})$/` → `Mekteb<NNNN>`; fallback (username bez sufiksa) je stabilan `Mekteb<userId>`, nikad random.

Pravilo (NOVI model): print kartica (`/muallim/print-kartice`) je PURE READ — SAMO računa i prikazuje `passwordFromUsername(...)`, NE radi bcrypt.hash ni db.update. Promjenu (upis novog hash-a) rade ISKLJUČIVO reset rute: `/ucenik/:id/reset-password` i `/roditelj/:id/reset-password`, koje UVIJEK vraćaju na `passwordFromUsername(user.username, user.id)` (prazan `{}` body; nema custom-password grane). Demo nalozi (`demo.*`) se prikazuju kao `demo123` i reset im se odbija.

**Why:** Raniji print je pri SVAKOM printu resetovao hash (i nekad davao par RAZLIČITE random lozinke). Korisnik je tražio: dodavanje učenika NE printa odmah; print SAMO prikazuje trenutno stanje i ne mijenja ništa; reset VRAĆA na stalnu `Mekteb<broj>` (svako dijete svoju stalnu šifru, NE globalni Mekteb2026).

**How to apply:** Drži invarijantu: print = čitanje (deterministički prikaz `Mekteb<sufiks>`, stabilno pri svakom pozivu, identično za par), reset = jedini upis (vrati na istu izvedenu vrijednost). Pri izmjenama UI teksta koristi "standardna šifra", ne "nova/resetovana". NE dirati: muallim password reset (`PUT /mekteb/muallimi/:id`), admin `/admin/reset-password`, ni self-service `/api/auth/reset-password` (email). Caveat: legacy nalozi sa starim custom/random hash-om će prikazati standardnu šifru koja ne radi dok se ne klikne reset — to je očekivano u novom modelu (nema mass-migracije).
