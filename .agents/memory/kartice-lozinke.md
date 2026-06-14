---
name: Kartice — standardna lozinka i print
description: Kako se izvode lozinke učenika/roditelja i zašto print kartica mora biti deterministički, ne random
---

Standardna lozinka učenika/roditelja je `Mekteb<NNNN>`, gdje je `NNNN` brojčani sufiks iz korisničkog imena (imena su oblika `ime.NNNN`). Učenik i roditelj kreirani ZAJEDNO (bulk) dijele isti sufiks → istu lozinku.

Pravilo: print kartica (`/muallim/print-kartice`) NE smije generisati nasumične lozinke. Mora izvesti lozinku iz username-a (`passwordFromUsername(username, userId)`) i resetovati hash na nju — deterministički, stabilno pri svakom printu, identično za par. Fallback (username bez sufiksa) je stabilan `Mekteb<userId>`, nikad random.

**Why:** Raniji print je svakom učeniku i svakom roditelju davao zaseban `Mekteb${random}` → par je imao RAZLIČITE lozinke koje su se mijenjale pri SVAKOM printu. Korisnik: "to je strašno, NIKAKO NE TREBA TAKO".

**How to apply:** Pri svakoj izmjeni print/reset tokova drži invarijantu: lozinka = `Mekteb<sufiks>` (fallback `Mekteb<userId>`), nikad random; lozinke su bcrypt-hashane pa se plaintext ne može pročitati kasnije — zato print resetuje na izvodljivu vrijednost. Bulk-create već garantuje da par dijeli sufiks (cijela transakcija se retry-ja sa NOVIM shared sufiksom na username koliziju). Demo nalozi (`demo.*`) ostaju `demo123`.
