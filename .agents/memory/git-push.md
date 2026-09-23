---
name: Git push na mektebnet projektu
description: Kako pushati na GitHub (sabahuddin/mektebnet) i zašto timing i token zahtijevaju oprez.
---

## GitHub integracija je pouzdan fallback
Remote URL i workspace token mogu vratiti 401. Tada koristi instaliranu GitHub integraciju i Git Data API umjesto traženja novih kredencijala.

**Why:** Integracija je uspješno prenijela commitove kada oba git-token pristupa nisu radila.

**How to apply:** Kreiraj blobove, tree i commitove preko GitHub API-ja, pa pomjeri `refs/heads/main` samo fast-forwardom. Šalji sekvencijalno oko 6–7 zahtjeva/s i poštuj `Retry-After`; Replit proxy ograničava GitHub na 10 zahtjeva/s.

## Lokalni i GitHub commit lanac mogu odstupati
GitSafe može lokalno dodati zaseban commit (npr. za uploadani asset) dok GitHub `main` ostane na ranijem commitu. Tada običan upload samo zadnjeg diff-a gubi međukomitne promjene.

**Why:** U ovom projektu se između potvrđenog GitHub SHA-a i funkcionalnog commita pojavio lokalni asset commit; provjera samo `HEAD^` bi pogrešno prijavila konflikt.

**How to apply:** Prvo očitaj GitHub `refs/heads/main`, zatim provjeri da je taj SHA predak lokalnog HEAD-a. Preko Git Data API-ja prenesi svaki nedostajući commit redom (uključujući binarne fajlove kao base64), ili napravi jedan commit sa kompletnim finalnim treejem. Nikad ne šalji samo zadnji diff ako remote nije njegov direktni roditelj.

Kad Git Data API stvori commit s drugim SHA-om za isti prethodni posao, remote SHA neće biti lokalni predak iako su izmijenjeni fajlovi usklađeni. Prije slanja narednog diff-a uporedi remote blob SHA svakog izmijenjenog fajla sa SHA tog fajla u lokalnom roditeljskom commitu. Ako se svi podudaraju, napravi GitHub tree preko remote `base_tree` sa samo tim izmjenama i pomjeri ref isključivo fast-forwardom; time se čuvaju svi ostali remote fajlovi.

**Why:** U ovom projektu API-push i lokalni commit često predstavljaju iste promjene s različitim commit SHA-ovima; oslanjanje na naziv commita ili lokalni `HEAD^` samo po sebi može prebrisati udaljene promjene.

**How to apply:** Provjeri svih izmijenjenih putanja, validiraj SHA novog treeja za njih prije stvaranja commita i odbij upis ako se remote glava promijenila u međuvremenu. Nikada ne radi force push.

## Coolify
Push triggeruje deploy preko Coolify-ja, ali Coolify uvijek treba RUČNI redeploy nakon push-a (self-hosted, mekteb.net). Napomeni korisniku da uradi redeploy.
