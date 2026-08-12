---
name: Sira kvizovi (sira.mekteb.net)
description: Zaseban statički sajt van monorepoa; localStorage-only, admin statistika je nužno per-uređaj (nema backend).
---

# Sira kvizovi (sira.mekteb.net)

Sira ("Poslanikova sira" kvizovi) je ZASEBAN statički HTML/JS sajt — NIJE u ovom
monorepou. Izvor postoji samo u `attached_assets/sira_*.zip`; živo je na
sira.mekteb.net (zaseban Coolify deploy), linkano s `home.tsx`.

**Arhitektura:** 100% client-side, BEZ backenda. Svi podaci (korisnici, bodovi,
historija kvizova) drže se u `localStorage` pod ključem `siretUsers` (sesija =
`currentUser`). `UserManager` je u `js/auth.js`; admin panel u `js/app.js`
(`showAdminPanel()` → `UserManager.getAllUsers()` čita `siretUsers`).

**Zašto admin ne vidi tuđe korisnike:** `localStorage` je izolovan po
browseru/uređaju. Admin panel čita samo listu spremljenu u adminovom VLASTITOM
browseru, pa vidi samo naloge napravljene na istom uređaju. Nije regresija —
tako je građeno (live fajlovi identični zip snapshotu; nema key-mismatcha,
registracija i admin oboje koriste `siretUsers`).

**Why (privacy):** registracija ima consent checkbox (`acceptStorageTerms`) koji
korisniku obećava da podaci ostaju samo na njegovom uređaju. Prebacivanje na
centralnu bazu mijenja taj privacy model — traži novi pristanak.

**How to apply:** Da admin stvarno vidi sve korisnike (sa svih uređaja) treba
backend (zajednička baza + API: register/login/submit-result/admin-stats), pa
Sira frontend da zove API umjesto localStorage. Mekteb već ima api-server +
Postgres koji se može iskoristiti. To je nova funkcionalnost, ne brza zakrpa.
