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
    - **Ilmihal Completion Gate (anti "click-through"):** Marking a lesson complete is gated by three conditions enforced both client- and server-side: (1) **300 seconds** of *active* reading time (tracked via Page Visibility API; paused when the tab is hidden), (2) scroll depth ≥ 85%, and (3) every visible accordion section opened at least once. Time is persisted in `korisnik_napredak.time_spent_seconds` (server keeps `MAX(stored, incoming)`); periodic 30s POST updates from the client. Backend rejects premature completion with HTTP **422 / `min_time_not_reached`**. After completion, the lesson stays accessible — time keeps accumulating, the "Provedeno: Xm Ys" pill is shown, but no further Aferim are awarded.
- **Messaging System:** Role-based access control for message visibility and sending capabilities.
- **Internationalization (i18n):** Supports multiple languages (BS, DE, EN, TR, AR) with automatic RTL detection for Arabic, geolocation-based language detection, and persistent language selection.
- **Admin Panel:** Provides comprehensive tools for managing muallims, users, analytics, quiz results, and student assignments.
- **H5P Tutorial:** `/muallim/h5p-uputstvo` — guides muallims through creating their first H5P exercise using the free Lumi Education desktop app, with download links and starter templates served from `public/h5p-templates/`.
- **H5P Statistika (muallim):** `/muallim/h5p-statistika` — per-grupa aggregation of H5P attempts per prilog showing student count, total attempts, average %, and weakest student. Weakest-student link drills into the student profile with a query param (`?h5pPrilogId=X`) that auto-filters the new H5P attempts list on `/muallim/ucenik/:id` to that exercise. Backed by `GET /api/muallim/h5p-stats?grupaId=X` and `GET /api/muallim/ucenik/:id/h5p-pokusaji?priloziId=optional`.
- **Security:** Captcha for login/registration, email notifications for new registrations, and planned SMTP integration.

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