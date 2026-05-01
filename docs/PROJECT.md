# Mekteb.net — Dokumentacija projekta

> Samohostovana islamska edukativna platforma na bosanskom jeziku.
> Stanje: maj 2026.

---

## 1. Pregled

Mekteb.net je samohostovana islamska edukativna platforma na bosanskom jeziku, namijenjena učenicima, roditeljima, muallimima i administratorima. Cilj je zamjena WordPress-baziranih mekteb sajtova jednim modernim, gameificiranim sistemom.

**Live deploy:** Coolify, prati `main` na `github.com/sabahuddin/mektebnet`.

---

## 2. Tehnički stack

| Sloj | Tehnologija |
|---|---|
| Backend | Node.js 24, Express 5, Drizzle ORM, PostgreSQL |
| Frontend | React 19, Vite 7, Tailwind CSS v4, Framer Motion, wouter (router) |
| Auth | JWT u HTTP-only cookie + Bearer token (mobilni) |
| Mailer | Nodemailer + Zoho SMTP (`smtppro.zoho.eu:465`) |
| Igre / H5P | h5p-standalone (frontend), adm-zip (server unzip) |
| Geo | ipapi.co (IP → jezik) |
| Dev infra | pnpm monorepo, project references, Replit sandbox |
| Sandbox specifika | Destruktivne git komande blokirane → idu kroz project taskove |

**Monorepo struktura:**

```
artifacts/
  api-server/              ← Express API
  mekteb-arapsko-pismo/    ← Glavni frontend (sav UI)
  mockup-sandbox/          ← Vite preview za prototipove komponenti
lib/
  db/                      ← Drizzle schema (zajednički)
  api-spec/                ← OpenAPI specifikacija
  api-zod/                 ← Zod validatori
  api-client-react/        ← Auto-generisani klijent
```

---

## 3. Database — sve tabele

### `users.ts`
- **users** — svi korisnici (admin / muallim / roditelj / ucenik), `password_hash`, `is_active`, `mekteb_id`

### `mekteb.ts`
- **mektebi** — mektebske ustanove
- **muallim_profili** — licence, max učenika, predmeti
- **grupe** — razredi/odjeljenja sa muallimom
- **ucenik_profili** — datum rođenja, grupa, mekteb
- **roditelj_profili** — pending/approved status
- **roditelj_ucenik** — link tabela (jedan roditelj → više djece)
- **pretplate** — Stripe pretplate (planirano)

### `content.ts`
- **ilmihal_lekcije** — 231 lekcija u 4 nivoa (sehadet, namaz, prijateljstvo, ekologija itd.); WYSIWYG sadržaj, video URL, slug
- **kvizovi** — 43 kviza, 1120+ pitanja
- **knjige** — 14 knjiga (uglavnom kissas-ul anbija, priče vjerovjesnika)
- **korisnik_napredak** — completion tracking po (user × content); `time_spent_seconds`, `bodovi`, `pokusaji`, `zavrsen`, `completed_at`
- **kviz_rezultati** — pojedinačni pokušaji kviza (max 1× dnevno)
- **posjete** — page view analytics
- **prilozi** — fajlovi/H5P paketi vezani za lekciju
- **rjecnik** — 314+ islamskih termina sa hover tooltips (`riječ`, `definicija`, `transkripcija`, `arapski`)
- **h5p_pokusaji** — pokušaji H5P vježbi sa scoringom

### `ednevnik.ts` (e-dnevnik)
- **prisustvo** — dnevno prisustvo po učeniku
- **ocjene** — ocjene 1–6 sa komentarom
- **mekteb_kalendar** — događaji (praznici, izleti, ispiti)
- **plan_lekcija** — sedmični plan
- **poruke** — interna komunikacija (sve role)
- **zadace** + **zadace_ucenici** — domaće sa per-učenik statusom
- **certifikati** — generisani certifikati

### `lessons.ts`
- **lessons** — meta lekcije za "Moj put" tab
- **student_progress** — `total_hasanat`, `streak_days`, `completed_lessons` (jsonb), `badges` (jsonb), `last_activity_date`
- **exercise_sessions** — pojedinačne H5P sesije (sa `time_spent_seconds`, `hasanat_earned`)

> **Napomena:** `lib/db/src/schema/` je zaštićena zona — bez ručnih izmjena. Schema se mijenja samo kroz migracije.

---

## 4. Backend moduli (`api-server/src/routes/`)

### `auth.ts` — autentifikacija
- `POST /login` — JWT login, captcha
- `POST /register-roditelj` / `register-roditelj-v2` — roditelj sa pending statusom
- `POST /register-ucenik` — učenik registracija (otvorena)
- `POST /register-mekteb` — novi mekteb (admin only)
- `POST /change-password`, `POST /logout`
- `GET /me` — trenutni korisnik
- `GET /geo` — IP → jezik (ipapi.co)

### `content.ts` — sadržaj + napredak
- `GET /ilmihal` — lista svih lekcija
- `GET /ilmihal/:slug` — lekcija + `userProgress = { timeSpentSeconds, zavrsen }`
- `GET /kvizovi`, `GET /kvizovi/:slug`
- `GET /knjige`, `GET /knjige/:slug`
- `GET /napredak` / `POST /napredak` — completion + anti-cheat gate (300s + scroll + sekcije)
- `POST /kviz-rezultat` — pokušaj kviza (1×/dan), evaluira bedževe
- `GET /rjecnik` — svi termini

### `muallim.ts` — panel za muallime
- Grupe: `GET/POST/PUT/DELETE /grupe`
- Učenici: `GET/POST /ucenici`, `POST /ucenici/bulk` (CSV import), `PUT /ucenici/:id/grupa`, `DELETE /ucenici/:id`
- Prisustvo: `POST /prisustvo`, `GET /prisustvo`, `GET /prisustvo-ucenik/:id`
- Ocjene: `POST /ocjene`, `GET /ocjene/:ucenikId`
- Roditelji: `POST /approve-roditelj`, `GET /pending-roditelji`
- Statistike: `GET /ucenik-rezultati/:id`, `GET /svi-rezultati`
- Kalendar: `GET/POST/DELETE /kalendar`, `POST /kalendar/batch`
- Plan lekcija: `GET/POST /plan-lekcija`

### `ucenik.ts` — panel za učenike
- `GET /profil` — profil sa `napredak: { totalHasanat, streakDays, bedzevi[] }` (sa `progress: {current, target}` za zaključane)
- `GET /kalendar`, `GET /plan-lekcija`, `GET /zadace`

### `roditelj.ts` — panel za roditelje
- `GET /djeca` — lista djece roditelja
- `GET /dashboard/:ucenikId` — sažetak napretka
- `GET /djeca-summary` — agregat za sve djece (badge count, hasanati)
- `GET /napredak/:ucenikId`, `GET /prisustvo/:ucenikId`, `GET /ocjene/:ucenikId`
- `POST /link-dijete`, `POST /dodaj-dijete`, `PUT /dijete-lozinka`
- `GET /kalendar`, `GET /zadace`

### `admin.ts` — admin panel
- Upload: `POST /upload-document`, `/upload-audio`, `/upload`
- Prilozi: `POST /prilozi/:lekcijaId` (file/URL/H5P), `GET /prilozi/:lekcijaId`, `GET /prilozi/download/:id`, `DELETE /prilozi/:id`
- Slike: `GET /uploads`, `GET /orphan-uploads` (čišćenje), `POST /lekcije/:id/insert-image`
- Korisnici: `GET /korisnici`, `PUT /korisnici/:id`, `POST /reset-password`
- Mektebi: `GET/POST /mektebi`
- Muallim/admin/učenik kreiranje: `POST /muallim`, `/admin`, `/ucenik`
- Ilmihal CRUD: `POST /ilmihal`, `PUT /ilmihal/:id` (sa `locked` zaštitom)
- Statistike: `GET /statistike`, `PUT /muallim/:id/licence`

### `games.ts` — server-side scoring igara
- `GET /credits` — koliko Aferima/minuta učenik ima
- `POST /start` — start sesije (server kreira session ID, anti-cheat)
- `POST /end` — kraj sesije (server validira score i trajanje)
- `GET /leaderboard` — globalna/mekteb/grupa
- `GET /personal-stats` — najbolji rezultat učenika

### `h5p.ts` — H5P interaktivne vježbe
- `POST /result` — predaja rezultata, ekonomija nagrada (1. pokušaj 100%, 2. 50%, 3+ 0% multiplier)
- `GET /attempts/:priloziId` — koliko puta je već radio + sljedeći multiplier

### `progress.ts` — alternativni progress endpoint (Moj put)
- `GET /progress` — student_progress agregat
- `POST /progress/lesson` — update completedLessons
- `POST /exercises/session` — H5P session log

### `poruke.ts` — messaging
- `GET /unread-count` — badge count
- `GET /` — inbox
- `GET /razgovor/:userId` — thread sa korisnikom
- `POST /` — pošalji poruku
- `POST /bulk` — masovno (muallim → cijeloj grupi)
- `GET /kontakti` — adresar (role-based)
- `PUT /:id/procitano`

### Pomoćni
- `lessons.ts`, `health.ts`, `import-content.ts`
- `pripreme-seed*.ts`, `pripreme-backfill.ts`, `regenerate-priprema-design.ts`, `full-data-seed.ts`, `rjecnik-seed.ts`
- Sve auto-skripte koriste `WHERE locked = false` da zaštite ručno verifikovan sadržaj.

---

## 5. Frontend stranice (`mekteb-arapsko-pismo/src/pages/`)

### Javni dio
- `home.tsx` — landing
- `login.tsx` — login sa captchom
- `register-roditelj.tsx` — registracija roditelja
- `arapsko-pismo.tsx` — gameificirano učenje arapskog pisma
- `karta-harfova.tsx` — interaktivna mapa harfova

### Učenik
- `ilmihal.tsx` — pregled svih lekcija (po nivoima i temama)
- **`ilmihal-lekcija.tsx`** ⭐ glavna lekcijska stranica
  - WYSIWYG sadržaj sa rječnik tooltips
  - Accordion sekcije (story, ilmihal, pitanja, zadatak)
  - Anti-cheat gate (300s + scroll≥85% + sve sekcije)
  - H5P vježbe sa attempt counterom
  - Celebration modal sa konfetama
  - "Označi kao završeno" sa one-shot Aferim award
- `kvizovi.tsx`, `kviz.tsx` — kvizovi (1×/dan)
- `citaonica.tsx`, `citaonica-knjiga.tsx` — knjige
- `progress.tsx` — "Moj put": hasanati, streak, bedževi (sa progress barovima za zaključane)
- `ucenik-profil.tsx` — profil
- `igrice.tsx` + `igrice/brzi-kviz.tsx`, `pamti-par.tsx`, `ljestvica.tsx`
- `exercise.tsx`, `lesson-detail.tsx` — Moj put detalji

### Muallim
- `muallim/index.tsx` — dashboard
- `muallim/grupa.tsx`, `dodaj-grupu.tsx`, `dodaj-ucenika.tsx`
- `muallim/prisustvo.tsx` — unos prisustva
- `muallim/izvjestaj.tsx` — izvještaji + Excel export
- `muallim/ucenik.tsx` — pojedinačni profil učenika
- `h5p-uputstvo.tsx` — uputstvo za kreiranje H5P preko Lumi Education

### Roditelj
- `roditelj.tsx` — dashboard sa svom djecom
- `roditelj/kalendar.tsx`, `roditelj/zadace.tsx`

### Admin
- `admin.tsx` — glavni panel
- `admin-rjecnik.tsx` — CRUD rječnika
- `admin-orphan-uploads.tsx` — čišćenje orfan fajlova

### Ostalo
- `poruke.tsx` — inbox + razgovori
- `not-found.tsx`

---

## 6. Ključne komponente i biblioteke

| Fajl | Šta radi |
|---|---|
| `components/celebration-modal.tsx` | Modal sa konfetama nakon completion-a (hasanati, streak, bedževi) |
| `components/h5p-player.tsx` + `h5p/` | h5p-standalone integracija sa attempt tracking |
| `components/wysiwyg-editor.tsx` | TipTap editor za admin (slike, Quran/Hadith blokovi, "ZAPAMTI" boxes) |
| `components/maskota.tsx` | Maskota sa SVG animacijama (pohvala, ohrabrenje) |
| `components/game-timer.tsx` | Tajmer za igre sa anti-cheat |
| `components/rjecnik-content.tsx` | Renderer sa hover tooltips za islamske termine |
| `components/layout.tsx` | App shell (header sa unread badge, sidebar po roli) |
| `components/ui/*` | shadcn/ui komponente (button, dialog, accordion, calendar, ...) |
| `lib/aferim.ts` | Padežna deklinacija ("1 Aferim", "5 Aferima"); samo za BS UI |
| `lib/api.ts` | Centralizirani `apiRequest` (Bearer token, error handling, `error.data`) |
| `lib/i18n.ts` | i18next setup, BS/DE/EN/TR/AR, RTL detekcija |
| `lib/student.ts` | Helperi za badge progress, streak računanje |
| `lib/sound-prefs.ts` | Preferencije zvuka (mute) |

---

## 7. Posebne osobine (cross-cutting)

### Anti-cheat sistem
- **Igre**: server-side scoring, validacija trajanja, partial unique indeksi za sesije, rate limiting
- **Kvizovi**: 1× dnevno po kvizu (`korisnik × kviz × datum`)
- **Ilmihal completion**: 300s aktivnog čitanja (Page Visibility API) + scroll ≥85% + sve accordion sekcije + one-shot award (`wasAlreadyCompleted` štiti od duplog Aferima); SQL `GREATEST` za race-safe update; HTTP 422 `min_time_not_reached`
- **H5P ekonomija**: 1. pokušaj 100% nagrade, 2. 50%, 3+ 0% (jasno najavljeno učeniku)

### Internacionalizacija
- BS / DE / EN / TR / AR
- Auto-detekcija po IP geolokaciji (ipapi.co)
- RTL za AR
- **Internal field/DB nazivi ostaju `hasanat*`**, samo BS UI koristi "Aferim" sa padežnom deklinacijom (1→Aferim, 2-4→Aferima, 5+→Aferima)

### Messaging — role-based access
- Učenik ↔ samo svoj muallim
- Roditelj ↔ muallim svoje djece + admin
- Muallim ↔ svi učenici svoje grupe + svi roditelji + admin
- Admin ↔ svi
- Bulk send: muallim → cijela grupa odjednom

### Gamifikacija
- **Hasanati / Aferimi** — krediti zarađeni kroz lekcije, kvizove, H5P
- **Streak** — uzastopni dani aktivnosti
- **Bedževi** — 16 bedževa, svaki sa pragom (npr. `lekcije_30` = 30 završenih lekcija); progress bar na `/napredak` za zaključane
- **Igrice** — Memory Match (harf↔ime), Brzi kviz, Pamti par; krediti se troše za igračko vrijeme
- **Ljestvica** — globalna / mekteb / grupa, sa privacy controls

### Izvještaji
- Excel export prisustva i ocjena (muallim panel)
- Detaljni reporti po učeniku (roditelj dashboard)
- Statistike za muallime (koje H5P vježbe se najviše rade)

### Sigurnost
- Captcha na login/register
- Email obavijesti pri novim registracijama
- `WHERE locked = false` u svim auto-skriptama (zaštita ručno verifikovanog sadržaja)
- JWT u HTTP-only cookie
- Server-side validacija svuda gdje klijent unosi vrijednosti

### Admin moći
- Upload (slike, audio, dokumenti, H5P paketi)
- Orfan uploads čišćenje
- Reset lozinki
- Licence muallimima (max učenika)
- Ilmihal CRUD sa `locked` flag-om

---

## 8. Tipičan tok podataka — primjer

**Učenik završava ilmihal lekciju:**

1. Učita `/ilmihal/ekologija` → frontend dohvati lekciju + `userProgress`
2. Tri parallel trackera: vrijeme (1s tick, samo dok tab aktivan), scroll (monoton), `openedSectionIds`
3. Svake 30s POST `/api/content/napredak` sa `timeSpentSeconds` (server radi `MAX`)
4. Učenik klikne "Označi kao završeno":
   - Frontend šalje POST sa `zavrsen: true`
   - Backend gate provjerava 300s; ako prerano → 422
   - Atomski UPDATE preko SQL `GREATEST`
   - Mirror u `student_progress` (15 hasanata + streak + evaluacija bedževa)
5. Frontend pokaže `CelebrationModal` (konfeti, novi bedževi, hasanati delta)
6. Pri povratku na lekciju → `userProgress.zavrsen=true` → "Provedeno: Xm Ys" + "Već završeno" pill, bez novih nagrada

---

## 9. Deployment

- **Production:** Coolify VPS, auto-deploy na svaki push u `main`.
- **Repo:** `github.com/sabahuddin/mektebnet`
- **Schema migracije:** Kontejner pri startu sam pokreće migracije kroz **dva paralelna sistema** (`artifacts/api-server/src/index.ts` → `startup()`):
  1. **Zvanični Drizzle migration sistem** (preferirani put): SQL fajlovi u `lib/db/drizzle/`, generisani kroz `pnpm --filter @workspace/db generate`. Pri startu se pozove `migrate()` iz `drizzle-orm/node-postgres/migrator`. Drizzle prati šta je primijenjeno preko `drizzle.__drizzle_migrations` tabele. Postojeća produkcija dobija no-op pri prvoj primjeni baseline-a (bootstrap fake-applies hash bez izvršavanja SQL-a).
  2. **Legacy `runMigrations()`** (backup): ručno održavan spisak idempotentnih `IF NOT EXISTS` ALTER linija u `index.ts` — i dalje radi paralelno dok se Drizzle put ne potvrdi na produkciji. Postoji da pokriva slučajeve gdje neko zaboravi da regeneriše Drizzle migration.

  **Workflow za novu schema izmjenu (preporuka):**
  1. Edituj fajl u `lib/db/src/schema/`.
  2. `pnpm --filter @workspace/db generate` → kreira `lib/db/drizzle/000N_<naziv>.sql`.
  3. Pregledaj generisani SQL, commit, push — Coolify deploy pokrene migraciju automatski.
- **Sandbox specifika:** destruktivne git komande (`push`, `rebase`, `branch -D`) blokirane → idu kroz project taskove.

---

*Dokument generisan automatski na osnovu trenutnog stanja koda — maj 2026.*
