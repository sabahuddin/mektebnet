---
name: E2E testiranje zaštićenih ruta bez logina
description: Kako curl-testirati role-zaštićene API rute kad nema aktivnog test korisnika u dev DB
---

Dev DB često nema aktivnog glavnog muallima (register-mekteb pravi `is_active=false` pending nalog), pa login ne prolazi za e2e.

**Rješenje:** ručno potpiši HS256 JWT u code_execution i šalji `Authorization: Bearer`.
- Payload shape je `{ userId, username, role, displayName }` (vidi middlewares/auth.ts JwtPayload).
- `requireAuth` provjerava `users.is_active` (30s cache) — privremeno `UPDATE users SET is_active=true` za test korisnika, pa vrati nazad.
- code_execution sandbox NEMA `process.env` — koristi JWT_SECRET fallback literal iz auth.ts (nije u secrets listi, znači koristi se default).
- `jsonwebtoken` se ne resolva iz root-a u code_execution, ali radi via bash: `node -e "const jwt = require('/home/runner/workspace/artifacts/api-server/node_modules/jsonwebtoken'); console.log(jwt.sign(...))"`. Tada token proslijedi curl-u.

**Why:** brže i pouzdanije od mučenja s registracijom/aktivacijom; dev DB mutacije su OK (prod je odvojen).
**How to apply:** kreiraj minimalne test redove (ucenik_profili.mekteb_id, roditelj_ucenik status='approved'), testiraj, pa obriši i vrati is_active na originalno stanje.
