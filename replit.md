# Mekteb.net — Islamska edukativna platforma

## Overview

Mekteb.net is an independent, self-hosted Islamic educational platform designed to replace traditional systems like WordPress. It offers a comprehensive suite of features for students, parents, and teachers (muallims), focusing on Islamic education with gamified learning and administrative tools.

**Key Capabilities:**
- **Arabic Script Learning:** Gamified lessons for Arabic alphabet and diacritics.
- **Ilmihal (Islamic Catechism):** 231 lessons across 4 levels.
- **Quizzes:** 43 quizzes with over 1120 questions.
- **Reading Room:** 14 books, primarily stories of prophets.
- **E-Diary:** Tracks attendance, grades (1-6), and lesson progress.
- **Muallim Panel:** Tools for managing students, groups, attendance, grades, calendar, lesson plans, statistics, and assignments.
- **Parent Panel:** Overview of children's attendance and grades.
- **Student Profile:** Access to grades, attendance, calendar, and quiz results.
- **Messaging System:** Internal communication between muallims, parents, students, and administrators with role-based access.
- **Gamification:** H5P exercises, daily quiz limits, and a game system with "Aferim" credits (BS UI; "Hasanat" in DE/EN/TR/AR) for game time, leaderboards, and anti-cheat mechanisms. Internal field/DB names retain `hasanat*` (e.g., `totalHasanat`, `hasanatGained`, `hasanatPerBlock`); only BS-language UI strings use Aferim with proper case forms (1 → "Aferim", 2+ → "Aferima") via `src/lib/aferim.ts` helper.
- **Comprehensive Reporting:** Detailed attendance and grade reports, with Excel export functionality.
- **Glossary:** Over 314 Islamic terms with interactive tooltips.

The platform aims to provide a modern, engaging, and efficient learning environment for Islamic education, leveraging current web technologies for a robust and scalable solution.

## User Preferences

- I prefer clear and concise communication.
- I expect the agent to ask for confirmation before making significant changes to the codebase or architectural decisions.
- I prefer an iterative development approach, with regular updates on progress.
- Do not make changes to the `lib/db/src/schema/` folder.
- Ensure that any auto-scripts (seed, restore, backfill) always include `WHERE locked = false` to protect manually verified content.
- Prioritize security in all implementations, especially regarding user data and content integrity.

## System Architecture

**Monorepo Structure:** The project is organized as a pnpm monorepo.
**Technology Stack:**
- **Backend:** Node.js 24, Express 5, PostgreSQL, Drizzle ORM.
- **Frontend:** React, Vite, Tailwind CSS v4, Framer Motion.
- **Authentication:** JWT (cookie-based).
- **Fonts:** Nunito (UI), Noto Naskh Arabic (Arabic text).
- **Styling:** Teal/green color scheme for a child-friendly design.
**Core Modules:**
- **API Server (`api-server/`):** Handles authentication, content delivery, muallim, student, parent, and admin specific functionalities.
- **Frontend (`mekteb-arapsko-pismo/`):** React application for user interface.
- **Database Schema (`lib/db/src/schema/`):** Defines database tables for users, groups, content (lessons, quizzes, books), attendance, grades, messages, and game-related data.
- **Schema Migrations:** Two parallel systems run at container startup (`artifacts/api-server/src/index.ts` → `startup()`):
  1. **Official Drizzle migrations** (preferred): SQL files in `lib/db/drizzle/` generated via `pnpm --filter @workspace/db generate`. Applied via `migrate()` from `drizzle-orm/node-postgres/migrator`. Tracked in `drizzle.__drizzle_migrations`. Existing prod DBs get a no-op baseline (bootstrap fake-applies the hash without running SQL).
  2. **Legacy `runMigrations()`** (backup): hand-maintained idempotent `IF NOT EXISTS` ALTER list in `index.ts`. Still runs in parallel as a safety net.
  Workflow for new schema changes: edit `lib/db/src/schema/` → `pnpm --filter @workspace/db generate` → review the new `lib/db/drizzle/000N_*.sql` → commit + push. Coolify deploy applies it automatically.
**Key Features Implementation:**
- **Content Management:** Ilmihal lessons, quizzes, and books are managed through dedicated APIs. Lessons can be locked by admins to prevent accidental modifications.
- **WYSIWYG Editor:** Utilizes TipTap for rich text editing of lessons, supporting image uploads and custom content blocks (e.g., Quranic verses/Hadith, 'REMEMBER' boxes).
- **Gamification:**
    - **Hasanat System:** Students earn "Hasanat" (credits) by completing H5P exercises, which can be used to unlock game time.
    - **Games:** "Memory Match" (Arabic letters), "Fast Quiz", "Glavni gradovi" (capitals), "Zastave svijeta" (flags), and "Mektebsko saće" (hex Tetris klon — flat-top hex grid 7×13, 5 figura, line clear). Server-scored gdje moguće (kviz/gradovi/zastave); klijent-scored igre (memory, sace) imaju per-second cap (sace: 350/s) + late-submit guard.
    - **Leaderboards:** Global, mekteb, and group-based leaderboards with privacy controls.
    - **Anti-Cheat Mechanisms:** Server-side validation of game scores, duration clamping, partial unique indices for game sessions, and rate limiting.
    - **Aferim/Med dvojna valuta:** `student_progress.total_hasanat` (Aferimi — zarađeni iz lekcija/kvizova/H5P-a, otključavaju vrijeme za igre, NE troše se) i nova `student_progress.total_med` (Med 🍯 — slatka nagrada zarađena samo igranjem igara, score=med 1:1; awarda se idempotentno na `/api/games/:slug/end` UPDATE guard preko sessionId). `/api/games/credits` i `/api/student/progress` vraćaju oba balansa; `useGameCredits` hook ih izlaže. Hero kartica na učeničkom profilu ima dvije stat kartice (Aferimi + Med) i `igrice` stranica oba prikazuje u credit baru.
    - **Popravi saće (wrong-answer remediation):** `pogresni_odgovori` tabela (UNIQUE `(user_id, source_type, source_id, question_index)`) bilježi pojedinačne pogreške iz kvizova. Kviz tracka samo single-correct tipove (radio/truefalse) i nakon submit-a POST-uje `/api/popravi-sace/zabiljezi` s **stabilnim originalnim indexom** iz `kviz.pitanja` (NE display index — shuffle/slice bi inače razbio UNIQUE). Učenik zatim na `/popravi-sace` rješava greške; tačan odgovor postavlja `resolved_at` i awarda **5 Aferima**. Endpoints: GET `/lista`, POST `/odgovor`, POST `/zabiljezi`, GET `/count` (svi auth-gated za `ucenik` rolu).
    - **Misije engine (dnevne/sedmične):** `misija_definicija` (7 default seed-anih misija, idempotent ON CONFLICT (kod)) + `misija_progress` (UNIQUE `(user_id, misija_id, period_key)`). Period key: `YYYY-MM-DD` (UTC) za dnevne, `YYYY-Www` (ISO sedmica) za sedmične. Progress se računa **autoritativno server-side** na `/api/misije/aktivne` iz `korisnik_napredak`/`kviz_rezultati`/`pogresni_odgovori`/`h5p_pokusaji` (uvjetTipovi: `complete_lesson_count`, `quiz_high_score_count`, `fix_mistake_count`, `h5p_attempt_count`). Claim je **race-safe**: dva-koraka — INSERT...ON CONFLICT DO UPDATE (osigurava red) → UPDATE WHERE `claimed_at IS NULL` RETURNING (samo prvi poziv vraća red i awarda). Default misije: 4 dnevne (lekcija, kviz, 3 popravljene greške, 1 H5P) + 3 sedmične (5 lekcija, 3 kviza ≥80%, 10 popravljenih grešaka).
    - **Ilmihal Completion Gate (anti "click-through"):** Marking a lesson complete is gated by three conditions enforced both client- and server-side: (1) **300 seconds** of *active* reading time (tracked via Page Visibility API; paused when the tab is hidden), (2) scroll depth ≥ 85%, and (3) every visible accordion section opened at least once. Time is persisted in `korisnik_napredak.time_spent_seconds` (server keeps `MAX(stored, incoming)`); periodic 30s POST updates from the client. Backend rejects premature completion with HTTP **422 / `min_time_not_reached`**. After completion, the lesson stays accessible — time keeps accumulating, the "Provedeno: Xm Ys" pill is shown, but no further Aferim are awarded.
- **Messaging System:** Role-based access control for message visibility and sending capabilities.
- **Internationalization (i18n) — PRIVREMENO ISKLJUČENO:** App je locked na bosanski. Google Translate widget je uklonjen iz `index.html` (Google Translate je davao neuredan prikaz, posebno za arapsko pismo). `LanguageProvider` (`src/context/language.tsx`) je drastično pojednostavljen: `lang` je uvijek `"bs"`, `setLang()` je no-op (zadržan API radi backward compat sa ~100 poziva u kodu), `t()` i `tr` čitaju iz `translations.bs`. `LanguageSwitcher` u `src/components/layout.tsx` se više ne renderuje (komponenta je ostavljena u fajlu radi lakšeg vraćanja). MIGRACIONI CLEANUP: `clearGoogTransCookie()` se poziva na svaki mount da ukloni `googtrans=/bs/<lang>` cookie koji postojeći produkcijski korisnici imaju keširan iz prethodne verzije (briše host-only, `=host`, `=.host` varijante sa `expires` u prošlosti). Briše se i `mekteb-lang` iz localStorage. KAD VRAĆAMO multi-jezik: koristiti pravi server-side i18n umjesto Google Translate; vidi git history za prethodnu verziju.
- **Home modul kartice (`src/pages/home.tsx`):** 5 kartica u 2-column grid (rounded-3xl card layout): Ilmihal, Kvizovi, Čitaonica, Igrice i Sufara. Sufara koristi `comingSoon: true` flag — kartica je vidljiva svim korisnicima ali nije klikabilna (bez `Link` wrappera) i ima "USKORO" / "BALD" / "SOON" / "YAKINDA" / "قريباً" badge u gornjem desnom uglu (i18n `home.uskoro`). Klasična `/arapsko-pismo` ruta i dalje radi za admine/muallime preko direktnog URL-a.
- **Admin Panel:** Provides comprehensive tools for managing muallims, users, analytics, quiz results, and student assignments.
- **H5P Tutorial:** `/muallim/h5p-uputstvo` — guides muallims through creating their first H5P exercise using the free Lumi Education desktop app, with download links and starter templates served from `public/h5p-templates/`.
- **H5P Statistika (muallim):** `/muallim/h5p-statistika` — per-grupa aggregation of H5P attempts per prilog showing student count, total attempts, average %, and weakest student. Weakest-student link drills into the student profile with a query param (`?h5pPrilogId=X`) that auto-filters the new H5P attempts list on `/muallim/ucenik/:id` to that exercise. Backed by `GET /api/muallim/h5p-stats?grupaId=X` and `GET /api/muallim/ucenik/:id/h5p-pokusaji?priloziId=optional`.
- **Security:** Captcha for login/registration, email notifications for new registrations, and planned SMTP integration.
- **PWA (Progressive Web App, Faza 1):** App je instalabilan na sve platforme — kroz `vite-plugin-pwa` (Workbox) generišu se `manifest.webmanifest`, `sw.js` i offline fallback (`/offline.html`). Manifest: `name="Mekteb — Islamska edukacija"`, `short_name="Mekteb"`, `theme_color="#248F8F"` (brand teal), `display="standalone"`, `id="${basePath}?source=pwa"` (basePath-aware za sub-path deployment), `start_url="/"`, `lang="bs"`. Ikone u `public/icons/` (generisane skriptom `scripts/generate-pwa-icons.mjs` iz `logo-mekteb.png` preko sharp): 192/512 (any), 512 maskable (Android adaptive sa 18% safe zone padding), 180/167/152/120 apple-touch-icon (Apple), 32/16 favicon. iOS standalone meta tagovi (`apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-title=Mekteb`, `apple-mobile-web-app-status-bar-style=default`). **Workbox runtime caching strategije** (alignovano sa STVARNIM backend rutama): Google Fonts → CacheFirst (1 god); `/api/content/(ilmihal|kvizovi|knjige|rjecnik)` + `/api/lessons*` → NetworkFirst sa 5s timeout-om i 14-dnevnim cache-om za offline javni sadržaj; `/(images|audio|sounds|h5p-templates)/` → CacheFirst sa range-request podrškom (30 dana). **NAMJERNO se NE cache-uju** auth-gated endpoint-i (`/api/progress`, `/api/popravi-sace`, `/api/misije`, `/api/games/credits`, `/api/content/napredak`, `/api/ucenik`, `/api/poruke`, `/api/h5p`) — privatni su, child A na shared device-u ne smije vidjeti child B podatke offline. Frontend ih uvijek hita sa servera; offline se oslanja na TanStack Query in-memory stale cache (per-session, briše se na logout). **Logout cache purge:** `AuthProvider.logout()` emituje `mekteb:logout` window event; `pwa.ts → purgePwaCaches()` iterira `caches.keys()` i briše sve CacheStorage entry-je (defense-in-depth). Navigation fallback ide na `/offline.html` (denylist `/api/*` i `/uploads/*`). Service worker se registrira lazy preko dinamičkog import-a u `src/pwa.ts` (NE u dev mode — `devOptions.enabled: false`); `<OfflineIndicator />` u `App.tsx` prikazuje toast-ove (offline / back online sync / update available) preko `window.dispatchEvent` event bridge-a (`mekteb:pwa-update-available`). Update flow: SW se auto-update-a (`registerType: "autoUpdate"`, `clientsClaim: true`, `skipWaiting: false` — korisnik mora kliknuti "Osvježi" da primijeni novu verziju). 49 precache entries (4.5MB).
- **Capacitor Mobile Wrapper (Faza 2):** Isti web codebase upakovan kao native app za Google Play (Android) i App Store (iOS) preko Capacitor 8. Bundle ID: `net.mektebnet.app`. **HYBRID strategija:** `webDir: "dist/public"` — pri buildu, statički bundle se kopira u native projekte (`npx cap sync` → `ios/App/App/public/` + `android/app/src/main/assets/public/`); app radi 100% offline iz bundled assets-a (Apple App Store traži ovo, ne primaju "samo wrapper"). API pozivi idu uvijek na `https://mekteb.net/api` preko `VITE_API_BASE_URL` koji je baked-in pri buildu (vidi `scripts/build-mobile.sh`). PWA Service Worker i dalje radi unutar webview-a — duplo offline osiguranje. **Backend CORS** (`artifacts/api-server/src/app.ts`) koristi dinamički origin function: dozvoljava `https://mekteb.net`, `https://www.mekteb.net`, `capacitor://localhost` (iOS — ne mijenjati `ios.scheme` jer to mijenja origin!), `https://localhost` (Android), `http://localhost`, Replit dev domeni (`*.replit.dev`, `*.repl.co`, `*.picard.replit.dev`), localhost na bilo kom portu; `credentials: true` za H5P cookie. **Plugin-i:** `@capacitor/app` (back button, app state), `@capacitor/network` (native offline detect), `@capacitor/status-bar` (DARK style + teal #248F8F), `@capacitor/splash-screen` (1.5s, brand teal). **Native asseti** generiraju se sa `pnpm run cap:assets` (`scripts/generate-native-icons.mjs`) — custom skripta umjesto `@capacitor/assets` jer pin-ovani sharp@0.32.6 ne radi na Node 24 (NAPI ABI mismatch); root sharp@0.34+ generiše AppIcon 1024×1024 + Splash 2732×2732 za iOS, i 5 mipmap densities (mdpi-xxxhdpi, 48-192px) + portrait/landscape splash drawables za Android, plus `values/ic_launcher_background.xml` (#248F8F). **Workflow** (sa korisnikove iMac mašine, vidi `MOBILE-BUILD.md`): `pnpm run cap:sync` (build mobile + sync) → `pnpm run cap:open:ios` (Xcode) ili `pnpm run cap:open:android` (Android Studio) → Archive/Build za store submit. Verzija u `ios/App/App/Info.plist` i `android/app/build.gradle`. Native projekti (`ios/`, `android/`) su committed u repo (lean: bundled assets su gitignore-ovani jer se regenerišu pri svakom sync-u).

## External Dependencies

- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Used for database interactions.
- **Tailwind CSS:** Frontend styling framework.
- **Framer Motion:** Animation library for React.
- **TipTap:** WYSIWYG editor for content creation.
- **Multer:** Node.js middleware for handling `multipart/form-data`, primarily for file uploads.
- **adm-zip:** Used for unpacking H5P files on the server.
- **h5p-standalone:** Frontend library for rendering H5P content.
- **ipapi.co:** Used for IP geolocation to auto-detect user language.
- **Nodemailer:** Planned for sending emails (requires SMTP configuration).
- **Stripe:** Planned for subscription management (requires Stripe account setup).