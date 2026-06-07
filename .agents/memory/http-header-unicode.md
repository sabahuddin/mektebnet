---
name: Unicode u HTTP headerima (Content-Disposition)
description: Bošnjački znakovi (đ/ć/š/č/ž) u nazivu fajla ruše setHeader; koristi RFC 5987.
---

Kad se naziv fajla (npr. naziv grupe u Excel izvozu) stavlja u `Content-Disposition`,
NE smije sadržavati znakove izvan latin1 (đ U+0111, ć U+0107, š U+0161, č, ž...).
Node `res.setHeader` baca `ERR_INVALID_CHAR` i ruta vrati 500.

**Why:** HTTP header vrijednosti su latin1; bošnjački/unicode znakovi izlaze van opsega.
Sanitizacija koja ZADRŽAVA unicode opsege (`\u0100-\u017F` itd.) ne pomaže — i dalje pada.

**How to apply:** Koristi RFC 5987 oblik (uzor postoji u `admin.ts`):
`Content-Disposition: attachment; filename="ascii-fallback.ext"; filename*=UTF-8''${encodeURIComponent(naziv)}`.
Na frontendu parsiraj prvo `filename\*=UTF-8''(...)` pa tek onda `filename="..."`.
