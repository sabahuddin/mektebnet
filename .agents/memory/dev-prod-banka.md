---
name: Dev vs prod banka pitanja
description: Replit dev DB has a stale pitanja_banka that does NOT match live production; production is the only source of truth.
---

# Dev vs prod banka pitanja

The Replit dev DB (`DATABASE_URL` = `helium/heliumdb`) contains a **stale, larger** `pitanja_banka` (~3513 rows) that does **not** match live production. The live app uses a **self-hosted** Postgres (`PROD_DATABASE_URL` = `91.98.234.55/mekteb`, Coolify) where `pitanja_banka` is ~2724 rows and is the **only source of truth**.

**Why:** A past session imported questions into the dev DB. The user saw "3513" in the Replit dev preview and later, seeing production's 2724, believed production had lost ~800 questions. It had not — production was verified intact (every bank question used by a quiz, 0 orphans, steady creation timeline from a 2576-row import on 2026-05-03 growing to 2724). The 3513 was always just the dev sandbox.

**How to apply:**
- Before ANY change to content (lessons, quizzes, banka pitanja, rječnik) follow `replit.md` rules (lines ~28–30): pull current state FROM production first, make a backup of the prod table BEFORE writing, and NEVER use dev/seed/backup tables as the source to overwrite production.
- Classifying/tagging questions is a production content change. Write ONLY the needed columns (e.g. `kategorija`, `tagovi`) keyed by `id`; never delete rows or overwrite unrelated columns.
- Treat the dev `pitanja_banka` count as meaningless for production reasoning.

## Kviz kategorije i tagovi su sada DB-driven (admin upravlja)
Glavne kategorije i tagovi pitanja žive u tabelama `kviz_kategorije` i `kviz_tagovi` (DB = izvor istine), admin ih dodaje/briše kroz "Banka pitanja" UI; bootstrap idempotentno seeduje iz konstanti (ON CONFLICT DO NOTHING) ali NE briše stale redove.

**Why:** Kategorije/tagovi su bili hardkodirani u frontu pa se "Kategorije" meni nije slagao sa stvarnošću. Korisnik je tražio potpunu slobodu (dodavati/brisati i kategorije i tagove).

**How to apply:**
- Kanonskih 5 kategorija koje produkcijska pitanja stvarno koriste: `akaid`, `ibadet`, `ahlak`, `historija`, `bosna`. Prod je usklađen na tačno tih 5 + 32 taga.
- Bootstrap samo dodaje; višak/stale kategorija se mora ručno obrisati (DELETE FROM kviz_kategorije WHERE slug NOT IN (...)). Uvijek backup prije (vidi `.local/state/prod-backup/`).
- Brisanje glavne kategorije ostavlja "orphan" tagove (`kviz_tagovi.kategorija` nema FK); UI ih grupira pod "Bez kategorije" da ih admin reklasificira/obriše — to je namjerno ponašanje, ne bug.
