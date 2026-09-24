---
name: WebP konverzija priloga
description: Zašto konverzija uploadovanih slika mora obuhvatiti i metapodatke nastavničkih materijala.
---

Kad se slika u trajnom uploads volumenu pretvori u WebP, promijeni i vezu materijala/priloga: naziv fajla na disku, izvorni naziv za preuzimanje, MIME tip i veličinu. Za ranije pretvorene slike čiji stari fajl nedostaje, ali odgovarajući WebP postoji, može se popraviti samo metapodatak bez ponovnog slanja slike.

**Why:** Stara konverzija je zamijenila reference u HTML lekcijama, ali ne i reference nastavničkih priloga. Galerija je zato dobijala 404 iako je WebP verzija istog fajla bila dostupna.

**How to apply:** Ažuriranje referenci obavi prije uklanjanja izvornog fajla, pa provjeri da cilj zaista postoji i vraća sliku, a ne SPA HTML fallback. Ne mijenjaj reference ako zamjenski WebP nije potvrđen.