---
name: API-server automatizovani testovi (node:test + tsx)
description: Kako pisati/pokretati e2e testove zaštićenih ruta u api-serveru
---

Api-server nema vanjski test framework — koristi se ugrađeni `node:test` preko `tsx`.

**Pokretanje:** `pnpm --filter @workspace/api-server test` (script: `tsx --test src/**/*.test.ts`). `tsx` je dodan kao catalog devDep jer Node native strip-types ne remapira `.js`→`.ts` importe ni workspace pakete koji exportuju `.ts`.

**Obrazac (vidi `src/routes/approve-roditelj.test.ts`):**
- Importuj pravi `app` iz `../app.js` i digni in-process server `app.listen(0)` na efemernom portu; gađaj kroz `fetch` da prođe cijeli middleware lanac (requireAuth + requireRole).
- Auth: potpiši JWT preko `signToken` iz `../middlewares/auth.js` (isti JWT_SECRET kao app), bez login flow-a. Korisnik mora imati `is_active=true` (requireAuth re-checkira status, 30s cache).
- DB: seed direktno preko `@workspace/db` s timestamp-unikatnim usernameom; `after()` mora obrisati sve (poruke, roditelj_ucenik, profili, users) — dev DB je zajednička.

**Why:** brže i pouzdanije od mock-ova; testira stvarne rute end-to-end. `tsc -p` u api-serveru javlja pred-postojeće greške nevezane za testove — to nije regresija od testa.
**How to apply:** novi test fajl `src/**/*.test.ts`, isti before/after seed-cleanup obrazac.
