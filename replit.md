# Mekteb.net — Islamska edukativna platforma

## Pregled

Samostalna platforma za islamsko obrazovanje koja zamjenjuje WordPress. Sadrži:
- Arapsko pismo (28 harfova + hareketi, gamifikacija)
- Ilmihal (231 lekcija u 4 nivoa)
- Kvizovi (27/43 sa pitanjima — 1120 pitanja ukupno)
- Čitaonica (14 knjiga — priče o poslanicima)
- E-dnevnik (prisustvo + ocjene 1-6 + lekcija naziv)
- Muallim panel (učenici, grupe, prisustvo, ocjene, kalendar, plan lekcija, profil, statistika/analitika, zadaće)
- Statistika/Izvještaji (zbirni pregled, matrica prisustva po datumima, mjesečni pregled, Excel export)
- Excel izvještaj (4 sheeta: Prisustvo, Prisustvo po mjesecu, Ocjene, Zbirni izvještaj)
- Roditelj panel (pregled djece, prisustvo, ocjene)
- Učenik profil (ocjene, prisustvo, kalendar, kvizovi)
- Poruke (muallim↔roditelj, muallim↔učenik, admin↔svi)
- Kviz daily limit (max 1x po kvizu dnevno)

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
│       ├── muallim.ts      # Muallim panel (grupe, učenici, prisustvo, ocjene, kalendar, plan lekcija, statistika, zadaće)
│       ├── ucenik.ts       # Učenik panel (profil, kalendar, plan lekcija)
│       ├── poruke.ts       # Poruke (messaging with role-based auth)
│       ├── roditelj.ts     # Roditelj panel (djeca, prisustvo, ocjene)
│       └── admin.ts        # Admin rute (korisnici CRUD, muallim-profili, licence edit, mektebi, statistike, image upload, prilozi/attachments)
└── mekteb-arapsko-pismo/   # React frontend
    └── src/pages/
        ├── home.tsx
        ├── login.tsx
        ├── register-roditelj.tsx
        ├── ilmihal.tsx / ilmihal-lekcija.tsx
        ├── kvizovi.tsx / kviz.tsx
        ├── citaonica.tsx / citaonica-knjiga.tsx
        ├── roditelj.tsx    # Roditelj panel
        ├── ucenik-profil.tsx  # Učenik profil (ocjene, prisustvo, kalendar, kvizovi)
        ├── poruke.tsx     # Poruke (messaging)
        └── muallim/
            ├── index.tsx   # Muallim panel (pregled, učenici, grupe, prisustvo, kalendar, plan lekcija, statistika, zadaće)
            ├── prisustvo.tsx  # Evidencija prisustva za grupu
            ├── ucenik.tsx     # Detalji učenika (prisustvo + ocjene)
            ├── dodaj-ucenika.tsx
            └── dodaj-grupu.tsx
lib/
└── db/src/schema/
    ├── users.ts        # users, muallim_profili, ucenik_profili, roditelj_profili
    ├── mekteb.ts       # grupe, roditelj_ucenik, pretplate, mektebi
    ├── ednevnik.ts     # prisustvo, ocjene, poruke
    ├── content.ts      # ilmihal_lekcije, kvizovi, knjige, korisnik_napredak, kviz_rezultati, posjete
    └── (kviz_rezultati = per-attempt tracking; posjete = visitor geo tracking)
uploads/                    # Uploadovane slike (iz admin WYSIWYG editora)
scripts/src/
└── import-content.ts   # Import iz edu ZIP fajla (ilmihal, kvizovi, knjige)
```

## Admin WYSIWYG Editor

- **TipTap** vizuelni editor za lekcije (ilmihal-lekcija.tsx)
- Dva moda: vizuelni (WYSIWYG) i HTML kod
- Upload slika: `POST /api/admin/upload` (multer, max 10MB, jpg/png/gif/webp)
- Statički serving: `/uploads/` servira uploadovane slike
- Custom blokovi: zeleni box (ajet/hadis), žuti box (ZAPAMTI)
- Formatiranje: bold, italic, underline, headings, liste, poravnanje, highlight, slike
- Komponenta: `src/components/wysiwyg-editor.tsx`

## Baza podataka

PostgreSQL (via DATABASE_URL). Ključne tabele:
- `users` — svi korisnici (role: admin/muallim/roditelj/ucenik)
- `muallim_profili` — profil muallima (licenceCount, licencesUsed)
- `ucenik_profili` — profil učenika (muallimId, grupaId, isArchived)
- `roditelj_ucenik` — veza roditelj↔dijete (status: pending/approved)
- `grupe` — razredi/grupe (naziv, skolskaGodina, daniNastave, vrijemeNastave)
- `prisustvo` — evidencija prisustva (status: prisutan/odsutan/zakasnio/opravdan)
- `ocjene` — ocjene učenika (kategorija: usmeno/pismeno/domaci/aktivnost/vladanje, ocjena 1-6, lekcijaNaziv)
- `poruke` — poruke (muallim↔roditelj, muallim↔učenik, admin↔svi; server-side auth)
- `mekteb_kalendar` — kalendar grupe (tip: mekteb/ferije/vazan_datum, opis)
- `plan_lekcija` — plan lekcija po danu (grupaId, datum, lekcijaNaslov, lekcijaTip, redoslijed)
- `ilmihal_lekcije` — 231 lekcija (nivo 1/2/21/3)
- `kvizovi` — 43 kviza (27 sa pitanjima = 1120 pitanja), modul: ilmihal/knjige
- `knjige` — 14 knjiga (priče o poslanicima)
- `korisnik_napredak` — praćenje napretka (zavrsen, bodovi)
- `prilozi` — fajl-prilozi uz lekcije (lekcijaId, originalName, storedName, fileSize, mimeType) — vidljivi muallimima i adminu

## API rute

### Auth (`/api/auth`)
- `POST /login` — prijava (username + password)
- `GET /geo` — IP geolokacija (isBiH: true/false za prikaz KM/EUR cijena)
- `POST /register-ucenik` — registracija odraslog (isActive: false, admin odobrava)
- `POST /register-roditelj-v2` — registracija roditelja s brojem djece (1-4, BuyMeACoffee link)
- `POST /register-mekteb` — zahtjev za registraciju mekteba (email, država, grad, naziv, paket, posebni zahtjevi)
- `POST /register-roditelj` — stara registracija roditelja (legacy)
- `POST /logout`
- `GET /me` — trenutni korisnik

### Content (`/api/content`)
- `GET /ilmihal?nivo=X` — lista lekcija
- `GET /ilmihal/:slug` — detalj lekcije
- `GET /kvizovi?nivo=X&modul=ilmihal` — lista kvizova
- `GET /kvizovi/:slug` — kviz s pitanjima
- `GET /knjige?kategorija=prica` — lista knjiga
- `GET /knjige/:slug` — detalj knjige
- `POST /napredak` — bilježenje završetka (50% threshold za bodove)
- `POST /kviz-rezultat` — čuvanje pojedinačnog pokušaja kviza
- `GET /kviz-rezultati` — historija kvizova za prijavljenog korisnika

### Muallim (`/api/muallim`) — zahtijeva role: muallim/admin
- `GET /grupe`, `POST /grupe`, `PUT /grupe/:id`
- `GET /ucenici`, `POST /ucenici`, `DELETE /ucenici/:id`
- `GET /prisustvo?grupaId=X&datum=YYYY-MM-DD`, `POST /prisustvo`
- `GET /prisustvo-ucenik/:ucenikId`
- `GET /ocjene/:ucenikId`, `POST /ocjene` (lekcijaNaziv, ocjena 1-6)
- `GET /pending-roditelji`, `POST /approve-roditelj`
- `GET /ucenik-rezultati/:id` — rezultati kvizova za učenika
- `GET/POST/DELETE /kalendar?grupaId=X` — kalendar grupe
- `GET/POST/DELETE /plan-lekcija?grupaId=X&datum=Y` — plan lekcija po danu
- `GET /lekcije-za-plan` — lista lekcija za odabir u planu
- `PUT /profil` — ažuriranje displayName

### Učenik (`/api/ucenik`) — zahtijeva role: ucenik
- `GET /profil` — profil sa ocjenama, prisustvom, kvizovima
- `GET /kalendar` — kalendar grupe učenika
- `GET /plan-lekcija` — plan lekcija za grupu učenika

### Poruke (`/api/poruke`) — zahtijeva auth
- `GET /` — inbox (grupirano po razgovorima)
- `GET /razgovor/:userId` — sve poruke s korisnikom
- `POST /` — slanje poruke (server-side auth: ucenik→samo svoj muallim)
- `POST /bulk` — grupno slanje (samo admin/muallim; validira primatelje)
- `GET /kontakti` — dostupni kontakti po roli (admin→muallimi, muallim→admin+učenici+roditelji s grupom, roditelj→muallimi+admin, učenik→svoj muallim)

### Roditelj (`/api/roditelj`) — zahtijeva role: roditelj/admin
- `GET /djeca` — lista odobrene djece
- `POST /link-dijete` — zahtjev za povezivanje (muallim odobrava)
- `POST /dodaj-dijete` — kreiranje dječjeg računa (max 4, Online Mekteb grupa, transakcija)
- `PUT /dijete-lozinka` — promjena lozinke djeteta
- `GET /prisustvo/:ucenikId`, `GET /ocjene/:ucenikId`, `GET /napredak/:ucenikId`

## Korisnici (test)
- `admin` / `admin123` — administrator
- `muallim1` / `muallim123` — muallim

## Format korisničkog imena učenika
`ime.XXXX` format (samo prvo ime + 4 cifre, auto-generisano), bez emaila. Muallim kreira učenike.
Roditelji se registruju sami i mogu: a) "Poveži dijete" (link existing, muallim odobrava), b) "Dodaj dijete" (kreira novi račun, dijete ide u "Online Mekteb" grupu, max 4 djece).

## Kviz formati (za import-content.ts)
- **Format 1**: `{type:'multiple', question:'...', options:[...], correct:'...'}` — single-quoted JS
- **Format 2a**: `{question: '...', options:[...], answer: '...'}` — single-quoted, no type
- **Format 2b**: `{"type":"checkbox",...}` — preskočeno (multiple correct)
- **Format 3**: knjige kvizovi: `{q:"...", a:[...], c: index}` — short field names

### Admin (`/api/admin`) — zahtijeva role: admin
- `GET /analytics` — analitika (registracije, posjete, kviz statistike)
- `GET /kviz-rezultati` — svi rezultati kvizova
- `POST /admin` — kreiranje admina
- `POST /ucenik` — kreiranje učenika

## Sigurnosne zaštite
- Captcha (a+b=?) na login i registraciji (client-side spam zaštita)
- Registracije šalju email notifikaciju na info@mekteb.net (SMTP čeka konfiguraciju)
- Nodemailer setup: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars

## i18n (internacionalizacija)

- **Jezici**: BS (default), DE, EN, TR, AR
- **Fajlovi**: `src/lib/i18n.ts` (prijevodi), `src/context/language.tsx` (LanguageProvider)
- **Hook**: `useLanguage()` → `{ lang, setLang, t, tr, isRTL }`
- **Geolokacija**: ipapi.co API za auto-detekciju jezika prema državi (AbortController + setTimeout fallback)
- **Persitencija**: localStorage `mekteb-lang`
- **RTL**: automatski za AR jezik
- **Prevedene stranice**: home, login, ilmihal, kvizovi, register-roditelj, arapsko-pismo (sufara)
- **Jezički prekidač**: Globe ikona u headeru sa dropdown-om

## Admin panel

- **Tabovi**: Muallimi | Korisnici | Analitika | Kviz rezultati (default: Muallimi)
- **Muallimi tab**: pregled svih muallima, grupe, broj učenika, expand za detalje
- **Korisnici tab**: CRUD, toggle aktivnost, edit profil, reset lozinke, raspoređivanje učenika
- **Analitika tab**: posjete, registracije, kviz uspješnost, korisnici po ulogama
- **Kviz rezultati tab**: svi kvizovi sa statistikama (pokušaji, prosječna tačnost)
- **Raspoređivanje učenika**: RasporediModal — admin može prebaciti učenika u drugu grupu/muallima
- **API**: `/admin/muallim-pregled`, `/admin/grupe-all`, `/admin/ucenik/:id/rasporedi`

## Preostalo za implementaciju
- SMTP kredencijali za info@mekteb.net — potrebno od korisnika
- Stripe pretplate — čeka Stripe nalog
- Docker/Coolify deployment config

