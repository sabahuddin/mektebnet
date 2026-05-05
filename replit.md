# Mekteb.net — Islamska edukativna platforma

## Overview

Mekteb.net is an independent, self-hosted Islamic educational platform designed to replace traditional systems. It offers a comprehensive suite of features for students, parents, and teachers (muallims), focusing on Islamic education with gamified learning and administrative tools.

**Key Capabilities:**
- **Gamified Learning:** Arabic script learning, Ilmihal lessons, and quizzes with a "Hasanat" credit system for game time.
- **Administrative Tools:** Muallim Panel for student/group management, attendance, grades, and lesson plans. Parent Panel for tracking children's progress.
- **Content:** Over 231 Ilmihal lessons, 43 quizzes with 1120+ questions, and a Reading Room with 12 books (Adem first by redoslijed=0).
- **Communication:** Internal messaging system for all user roles.
- **Reporting:** Detailed attendance and grade reports with Excel export.
- **Glossary:** Over 314 Islamic terms with interactive tooltips.

The platform aims to provide a modern, engaging, and efficient learning environment for Islamic education, leveraging current web technologies for a robust and scalable solution.

## User Preferences

- I prefer clear and concise communication.
- I expect the agent to ask for confirmation before making significant changes to the codebase or architectural decisions.
- I prefer an iterative development approach, with regular updates on progress.
- Do not make changes to the `lib/db/src/schema/` folder.
- Ensure that any auto-scripts (seed, restore, backfill) always include `WHERE locked = false` to protect manually verified content.
- Prioritize security in all implementations, especially regarding user data and content integrity.
- **OBAVEZNO: UVIJEK pushati na GitHub/Coolify sam (via code_execution sandbox) — NIKAD ne slati korisnika u Shell.** Koristiti `execSync('git add ... && git commit ... && git push ...')` iz code_execution.
- Korisnik govori bosanski. Komunikacija na bosanskom, bez emojija, smiren ton.
- Kad nesto fali (slika, podatak) — NIKAD ne generisati zamjenu bez pitanja. Prvo provjeriti backup, git historiju, attached_assets. Pitati korisnika ako izvor nije jasan.
- Dev baza i produkcijska baza su ODVOJENE. Korisnici, banka pitanja, muallimi postoje samo na produkciji (Coolify Postgres). Dev baza ima samo sadržaj (lekcije, kvizove, rječnik).
- **APSOLUTNO PRAVILO — SADRŽAJ:** Prije BILO KAKVOG diranja sadržaja lekcija, kvizova, rječnika ili bilo čega osim čistog koda — OBAVEZNO prvo povući aktuelni sadržaj sa PRODUKCIJE (mekteb.net API) i koristiti ga kao izvor istine. Produkcija je UVIJEK zadnja verzija. NIKAD ne koristiti dev bazu, seed fajlove ili backup tabele kao izvor za prepisivanje produkcijskog sadržaja. NIKAD ne pisati boot migracije koje mijenjaju content_html bez eksplicitnog odobrenja korisnika. Backup produkcijske baze napraviti PRIJE svake promjene.
- **APSOLUTNO PRAVILO — ANALIZA PRIJE AKCIJE:** Kad se otkrije problem, PRVO zaustaviti se i analizirati uzrok. Identificirati šta je izazvalo problem. Obrisati/popraviti uzrok. TEK ONDA raditi novi kod. NIKAD ne dodavati novi kod preko postojećeg problema.

## Deployment

- **Hosting:** Coolify (self-hosted) na korisnikovom serveru.
- **GitHub repo:** sabahuddin/mektebnet (remote: `github`)
- **Push metoda:** Iz `bash` tool-a (NE iz code_execution sandbox-a — sandbox NEMA pristup secret env vars). Komanda:
  `git push "https://sabahuddin:${GITHUB_TOKEN}@github.com/sabahuddin/mektebnet.git" HEAD:main`
- **Token:** Aktivan secret je `GITHUB_TOKEN` (NE `GITHUB_PERSONAL_ACCESS_TOKEN` — taj je stari/expired). Trajanje 90 dana, korisnik osvježava ručno u Replit Secrets. Verifikacija: `curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user` → mora vratiti `"login":"sabahuddin"`.
- **Coolify deploy:** Coolify NE radi auto-deploy. Korisnik RUČNO pokreće redeploy iz Coolify panela nakon git push-a.
- **Boot migracije (index.ts):** Pri startu servera automatski: fill-gaps (dodaj lekcije koje fale — INSERT ON CONFLICT DO NOTHING, nikad UPDATE), migracija banke pitanja. NEMA boot migracija koje mijenjaju content_html.
- **UKLONJENI opasni endpointi (maj 2026):** `sync-from-seed` i `restore-diac` su OBRISANI jer su prepisivali produkcijski content_html sa skraćenim seed podacima. Nikada ih ne vraćati.
- **Auto-zaključavanje lekcija:** Admin PUT /ilmihal/:id automatski zaključava lekciju nakon svakog save-a. Lock provjera je uklonjena — admin uvijek može uređivati. Lock služi SAMO kao zaštita od automatskih skripti (fill-gaps, seed).
- **Sve lekcije na produkciji zaključane (04.05.2026):** Svih 236 lekcija zaključano. Nove lekcije se automatski zaključavaju pri prvom save-u.
- **Roditelji tab (maj 2026):** Muallim panel ima novi "Roditelji" tab sa dva pod-prikaza: Obavještenja (CRUD story/objave za roditelje, sa slikom i grupnim filterom) i Lista roditelja (kontakt podaci roditelja po grupama). Roditelji vide obavještenja na svom dashboardu (/roditelj). DB tabela: `obavjestenja`. API: GET/POST/PUT/DELETE /muallim/obavjestenja, GET /muallim/roditelji-lista, GET /roditelj/obavjestenja.

## System Architecture

**Monorepo Structure:** The project is organized as a pnpm monorepo.

**Technology Stack:**
- **Backend:** Node.js 24, Express 5, PostgreSQL, Drizzle ORM.
- **Frontend:** React, Vite, Tailwind CSS v4, Framer Motion.
- **Authentication:** JWT (cookie-based).
- **Fonts:** Nunito (UI), Noto Naskh Arabic (Arabic text).
- **Styling:** Teal/green color scheme for a child-friendly design.

**Core Modules:**
- **API Server (`api-server/`):** Handles authentication, content delivery, and role-specific functionalities.
- **Frontend (`mekteb-arapsko-pismo/`):** React application for the user interface.
- **Database Schema (`lib/db/src/schema/`):** Defines database tables for users, groups, content, and game-related data.
- **Schema Migrations:** Utilizes Drizzle migrations for database schema evolution.

**Key Features Implementation:**
- **Content Management:** Lessons, quizzes, and books are managed via APIs, with admin controls for content locking. TipTap is used for rich text editing.
- **Gamification:**
    - **Hasanat System:** Credits earned through H5P exercises, used to unlock game time.
    - **Games:** Includes "Memory Match", "Fast Quiz", "Glavni gradovi", "Zastave svijeta", "Mektebsko saće", and "Medena staza". Games have server-side scoring and anti-cheat mechanisms.
    - **Medena staza (Honey Path):** A quiz-based game with 8 fixed knowledge categories, drawing questions from `igra_pitanja` table. Includes an Admin UI editor for managing questions.
    - **"Med" Currency:** A second currency earned from playing games, separate from Hasanat.
    - **Popravi saće (Fix Mistakes):** A system for students to review and correct past quiz mistakes, awarding additional Hasanat.
    - **Missions Engine:** Daily and weekly missions with server-side progress tracking and race-safe claiming mechanisms for rewards.
    - **Ilmihal Completion Gate:** Enforces conditions (reading time, scroll depth, accordion interaction) before marking a lesson complete to prevent "click-throughs".
- **Messaging System:** Role-based access control for internal communication.
- **Internationalization (i18n):** Currently locked to Bosnian, with future plans for full multi-language support.
- **Navigation:** Flat main navigation with direct links (no dropdowns). Logout button with icon+text next to A+/- font controls for logged-in users. Panel is a direct link. A "Sufara" module is planned and shown as "coming soon."
- **Bee Welcome Animation (SelamWelcome):** On first session visit, a bee mascot appears center-screen with a speech bubble saying "Esselamu alejkum, [name]! Idemo s Bismillom!" — auto-dismisses after ~5s, once per session (sessionStorage). Can be disabled in Roditelj Profil tab (localStorage `mekteb-selam-disabled`).
- **Maskota varijante (maj 2026):** Dvije pose pčele — `pcela.png` (frontalna, sa knjigom — koristi se u empty states, celebrations, statičnim pozdravima) i `pcela-letenje.png` (bočni profil, leti udesno — koristi se u SelamWelcome i FlyingMaskota animacijama gdje pčela preleti preko ekrana). Bočna poza je obavezna jer pčele zaista lete bočno, ne sa stomakom prema gledaocu. Sve trajektorije letenja idu lijevo→desno pa nema potrebe za horizontalnim flip-om.
- **Roditelj Panel (tab-based, maj 2026):** Top-level tabs: Obavještenja, [child name tabs], Poruke (navigates to /poruke), Profil. Each child tab shows summary stats + sub-tabs in order: Kalendar (default), Zadaća, Ocjene, Prisustvo. Profil tab has PushToggle, add/link child, selam toggle. Standalone /roditelj/kalendar and /roditelj/zadace routes still exist.
- **Čitaonica cleanup boot script (maj 2026):** Idempotentni cleanup u `runDataBootstrap()` (api-server/src/index.ts): briše duplikate "Ilmihal za djecu" (slug `knjiga-ilmihal`/`ilmihal` — ilmihal sadržaj je u /ilmihal modulu), postavlja Adem na redoslijed=0 (prvi poslanik hronološki), prebacuje cover_image za SVIH 12 priča (adem, musa, nuh, sulejman, ismail, muhammed-2-poslanstvo-do-hidzre + ibrahim, isa, davud, jusuf, muhammed-1-djetinjstvo, muhammed-3-medinski-period) iz `/api/uploads/citaonica/<slug>.png` na bundleane public slike `/citaonica/<slug>.png`. Update koristi egzaktno staro path-matchovanje (`= '/api/uploads/citaonica/' || slug || '.png'`) da NE prepiše custom uploadane slike (multer admin upload). Svih 12 cover slika je sad u `public/citaonica/` bundle-u — ne ovisi o `/api/uploads/` volume mountu na produ. API endpoint `/api/content/knjige` sortira po `redoslijed asc, id asc`.
- **Ilmihal cleanup + uvodne riječi boot script (maj 2026):** Idempotentni cleanup u `runDataBootstrap()` (api-server/src/index.ts) odmah nakon Čitaonica bloka. (1) **DELETE 4 duplikat/test lekcija** koje su se "pojavile odnekud" samo na produkciji: Nivo 1 (`lekcija-01`/"LEKCIJA 1: IMANSKI ŠARTI" id=181, `tesbih` id=197), Nivo 2 (`amentu-billahi` CAPS id=106 — duplikat legitimnog `mentu-billahi`; `ve-melaiketihi` CAPS id=156 — duplikat legitimnog `ve-melaikethi`). (2) **UPDATE Nivo 1 `uvodna-rijec`** sa kratkim motivacijskim tekstom (uklonjen PRIPREMA-START akordion + btn-wow kviz dugme). Idempotentno: WHERE klauzula match-uje `LIKE '%PRIPREMA-START%' OR '%hero-box%' OR '%lesson-accordion%' OR '%lesson-container%'` — drugi restart neće raditi UPDATE jer markeri više neće postojati. (3) **INSERT Nivo 2 (`uvodna-rijec-nivo-2`) i Nivo 3 (`uvodna-rijec-nivo-3`)** sa motivacijskim tekstovima prilagođenim uzrastu (~8-9 god, ~10-11 god). ON CONFLICT DO NOTHING; redoslijed=0; locked=true odmah. (4) Dodatni UPDATE blokovi za Nivo 2/3 ako su već unijete sa starim wrapped HTML-om (LIKE '%lesson-container%') — popravljaju na flat strukturu.
- **Ilmihal flat HTML strukturna pravila (KRITIČNO):** Frontend `parseSections()` u `ilmihal-lekcija.tsx` parsuje `.lesson-accordion` elemente. Ako lekcija nema akordione, koristi se `RjecnikContent` fallback render (linija 2566). MEĐUTIM, CSS u `index.css:417-423` skriva `.ilmihal-content .lesson-container`, `.hero-box`, `.lesson-accordion`, `h1:first-child` sa `display: none` (jer React klasično parsuje strukturu i prikazuje child elemente direktno na `.ilmihal-content` root nivou). Posljedica: za jednostavne flat lekcije (poput uvodnih riječi) HTML NE smije biti wrap-ovan u `<div class="lesson-container">` niti smije imati `<h1>` na vrhu. Direktno na root nivou stavi `<p class="lesson-text">`, `<div class="info-box">`, `<div class="arabic-card">` — naslov se prikazuje iznad iz `lekcija.naslov`. Ovo pravilo se primjenjuje na svaki novi flat-style ilmihal HTML (uvodne riječi, sažeci, kratki tekstovi).
- **Admin Panel:** Tools for managing users, analytics, quiz results, and assignments. Includes H5P tutorial and statistics.
- **Security:** Captcha for login/registration.
- **PWA (Progressive Web App):** The application is installable across platforms, utilizing `vite-plugin-pwa` for offline capabilities and service worker caching strategies that prioritize public content. Auth-gated endpoints are explicitly not cached for security.
- **Push Notifications:** OneSignal integration for web and native push notifications. Backend triggers for new messages and assignments. Includes database schema for `push_tokens` and frontend integration with `react-onesignal`. Native mobile push is supported via Capacitor with full configuration for iOS and Android.
- **Capacitor Mobile Wrapper:** The web codebase is wrapped as a native application for iOS and Android using Capacitor, enabling offline operation from bundled assets and secure API calls. Custom scripts are used for native asset generation.

## External Dependencies

- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Used for database interactions.
- **Tailwind CSS:** Frontend styling framework.
- **Framer Motion:** Animation library for React.
- **TipTap:** WYSIWYG editor for content creation.
- **Multer:** For `multipart/form-data` handling (file uploads).
- **adm-zip:** For unpacking H5P files on the server.
- **h5p-standalone:** Frontend library for rendering H5P content.
- **OneSignal:** For push notifications.
- **ipapi.co:** For IP geolocation (currently removed as i18n is disabled).
- **Nodemailer:** Planned for email sending.
- **Stripe:** Planned for subscription management.