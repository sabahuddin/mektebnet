---
name: Lažne tsc greške iz stale lib/db builda
description: Zašto api-server tsc prijavljuje "Property X does not exist" za kolone koje očito postoje u schemi
---

Kad `tsc --noEmit` u `artifacts/api-server` prijavi `TS2339: Property '<kolona>' does not exist` za kolonu koja jasno postoji u `lib/db/src/schema/*.ts`, greška najčešće NIJE u kodu — `lib/db` je TypeScript project reference i api-server čita njene **build artefakte** (`lib/db/dist/*.d.ts`), ne izvor. Ako je schema dopunjena a `lib/db` nije rebuildan, `.d.ts` ne zna za novu kolonu.

**Fix:** `npx tsc -b lib/db` pa ponovi typecheck.

**Why:** Ove greške izgledaju kao stvarni pre-postojeći bugovi u rutama i lako se odbace kao "nije moja regresija", pa ostanu mjesecima i obore completion review. Rebuild ih briše bez ijedne izmjene u kodu.

**How to apply:** Prije nego proglasiš tsc grešku pre-postojećom ili tuđom, provjeri da li se odnosi na simbol iz workspace paketa (`@workspace/db`, `@workspace/api-zod`) — ako da, prvo `tsc -b` taj paket.
