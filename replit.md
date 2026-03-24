<<<<<<< HEAD
# Mekteb.net — Islamska edukativna platforma

## Pregled

Samostalna platforma za islamsko obrazovanje koja zamjenjuje WordPress. Sadrži:
- Arapsko pismo (28 harfova + hareketi, gamifikacija)
- Ilmihal (231 lekcija u 4 nivoa)
- Kvizovi (27/43 sa pitanjima — 1120 pitanja ukupno)
- Čitaonica (14 knjiga — priče o poslanicima)
- E-dnevnik (prisustvo + ocjene)
- Muallim panel (učenici, grupe, prisustvo, ocjene)
- Roditelj panel (pregled djece, prisustvo, ocjene)

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24
- **API**: Express 5 + PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS v4 + Framer Motion
- **Auth**: JWT (cookie-based); JWT_SECRET env var (default: "mekteb-secret-change-in-production")
- **Fontovi**: Nunito (UI), Noto Naskh Arabic (arapski tekst)
- **Boje**: Teal/zelena (child-friendly dizajn)

## Struktura

```text
artifacts/
├── api-server/             # Express API server (port iz PORT env)
│   └── src/routes/
│       ├── auth.ts         # POST /login, POST /register, POST /logout
│       ├── content.ts      # GET/POST ilmihal, kvizovi, knjige, napredak
│       ├── muallim.ts      # Muallim panel (grupe, učenici, prisustvo, ocjene)
│       ├── roditelj.ts     # Roditelj panel (djeca, prisustvo, ocjene)
│       └── admin.ts        # Admin rute
└── mekteb-arapsko-pismo/   # React frontend
    └── src/pages/
        ├── home.tsx
        ├── login.tsx
        ├── register-roditelj.tsx
        ├── ilmihal.tsx / ilmihal-lekcija.tsx
        ├── kvizovi.tsx / kviz.tsx
        ├── citaonica.tsx / citaonica-knjiga.tsx
        ├── roditelj.tsx    # Roditelj panel
        └── muallim/
            ├── index.tsx   # Muallim panel (pregled, učenici, grupe, prisustvo tab)
            ├── prisustvo.tsx  # Evidencija prisustva za grupu
            ├── ucenik.tsx     # Detalji učenika (prisustvo + ocjene)
            ├── dodaj-ucenika.tsx
            └── dodaj-grupu.tsx
lib/
└── db/src/schema/
    ├── users.ts        # users, muallim_profili, ucenik_profili, roditelj_profili
    ├── mekteb.ts       # grupe, roditelj_ucenik, pretplate, mektebi
    ├── ednevnik.ts     # prisustvo, ocjene, poruke
    └── content.ts      # ilmihal_lekcije, kvizovi, knjige, korisnik_napredak
scripts/src/
└── import-content.ts   # Import iz edu ZIP fajla (ilmihal, kvizovi, knjige)
```

## Baza podataka

PostgreSQL (via DATABASE_URL). Ključne tabele:
- `users` — svi korisnici (role: admin/muallim/roditelj/ucenik)
- `muallim_profili` — profil muallima (licenceCount, licencesUsed)
- `ucenik_profili` — profil učenika (muallimId, grupaId, isArchived)
- `roditelj_ucenik` — veza roditelj↔dijete (status: pending/approved)
- `grupe` — razredi/grupe (naziv, skolskaGodina, daniNastave, vrijemeNastave)
- `prisustvo` — evidencija prisustva (status: prisutan/odsutan/zakasnio/opravdan)
- `ocjene` — ocjene učenika (kategorija: usmeno/pismeno/domaci/aktivnost/vladanje)
- `poruke` — poruke između muallima i roditelja
- `ilmihal_lekcije` — 231 lekcija (nivo 1/2/21/3)
- `kvizovi` — 43 kviza (27 sa pitanjima = 1120 pitanja), modul: ilmihal/knjige
- `knjige` — 14 knjiga (priče o poslanicima)
- `korisnik_napredak` — praćenje napretka (zavrsen, bodovi)

## API rute

### Auth (`/api/auth`)
- `POST /login` — prijava (username + password)
- `POST /register` — registracija roditelja
- `POST /logout`
- `GET /me` — trenutni korisnik

### Content (`/api/content`)
- `GET /ilmihal?nivo=X` — lista lekcija
- `GET /ilmihal/:slug` — detalj lekcije
- `GET /kvizovi?nivo=X&modul=ilmihal` — lista kvizova
- `GET /kvizovi/:slug` — kviz s pitanjima
- `GET /knjige?kategorija=prica` — lista knjiga
- `GET /knjige/:slug` — detalj knjige
- `POST /napredak` — bilježenje završetka

### Muallim (`/api/muallim`) — zahtijeva role: muallim/admin
- `GET /grupe`, `POST /grupe`, `PUT /grupe/:id`
- `GET /ucenici`, `POST /ucenici`, `DELETE /ucenici/:id`
- `GET /prisustvo?grupaId=X&datum=YYYY-MM-DD`, `POST /prisustvo`
- `GET /prisustvo-ucenik/:ucenikId`
- `GET /ocjene/:ucenikId`, `POST /ocjene`
- `GET /pending-roditelji`, `POST /approve-roditelj`

### Roditelj (`/api/roditelj`) — zahtijeva role: roditelj/admin
- `GET /djeca` — lista odobrene djece
- `POST /link-dijete` — zahtjev za povezivanje
- `GET /prisustvo/:ucenikId`, `GET /ocjene/:ucenikId`, `GET /napredak/:ucenikId`

## Korisnici (test)
- `admin` / `admin123` — administrator
- `muallim1` / `muallim123` — muallim

## Format korisničkog imena učenika
`displayName.1234` format (auto-generisano), bez emaila. Muallim kreira učenike.
Roditelji se registruju sami i zatim traže link ka djetetu (muallim odobrava).

## Kviz formati (za import-content.ts)
- **Format 1**: `{type:'multiple', question:'...', options:[...], correct:'...'}` — single-quoted JS
- **Format 2a**: `{question: '...', options:[...], answer: '...'}` — single-quoted, no type
- **Format 2b**: `{"type":"checkbox",...}` — preskočeno (multiple correct)
- **Format 3**: knjige kvizovi: `{q:"...", a:[...], c: index}` — short field names

## Preostalo za implementaciju
- Poruke (parent-teacher messaging) — API postoji, frontend nedostaje
- Stripe pretplate — čeka Stripe nalog
- Admin analitika panel
- Docker/Coolify deployment config
=======
# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
>>>>>>> 6f06445 (Initial commit)
