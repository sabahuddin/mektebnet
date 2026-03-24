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
