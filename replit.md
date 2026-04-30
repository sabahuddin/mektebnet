# Mekteb.net — Islamska edukativna platforma

## Overview

Mekteb.net is an independent, gamified, and comprehensive Islamic educational platform designed to replace traditional WordPress-based solutions. It offers a structured learning environment for Arabic script, Islamic jurisprudence (Ilmihal), and Quranic stories, complemented by interactive quizzes and an e-diary system for tracking student progress. The platform aims to provide a rich educational experience for students, an efficient management system for teachers (muallims), and transparent oversight for parents. Key capabilities include:

-   **Gamified Arabic Script Learning:** Interactive lessons for the 28 Arabic letters and diacritics.
-   **Structured Islamic Curriculum:** 231 Ilmihal lessons across 4 levels.
-   **Extensive Quizzing:** 27 quizzes with over 1120 questions.
-   **Digital Library:** 14 books, primarily stories of prophets.
-   **E-Diary System:** For attendance tracking, grading (1-6 scale), and lesson logging.
-   **Role-Based Panels:** Dedicated interfaces for Muallims (teachers), Parents, and Students, each with tailored functionalities like group management, attendance, grades, calendar, lesson plans, statistics, and messaging.
-   **Reporting & Analytics:** Comprehensive reports, attendance matrices, monthly overviews, and Excel exports for administrative insights.
-   **Messaging System:** Secure communication channels between various user roles (muallim↔parent, muallim↔student, admin↔all).
-   **Gamification & Progress Tracking:** Quizzes with daily limits, progress tracking for lessons, and game-based learning with leaderboards and rewards (Hasanat).

The project's vision is to become a leading platform for Islamic education, leveraging technology to make learning engaging and accessible.

## User Preferences

I prefer concise and direct communication. When making changes, prioritize core functionalities and architectural improvements. Please ask for confirmation before implementing any major architectural shifts or adding new external dependencies. For code, I prefer clean, readable, and maintainable solutions. Do not make changes to files related to `rjecnik` unless specifically instructed.

## System Architecture

The platform is built as a monorepo using `pnpm workspaces`, ensuring a streamlined development workflow.

**Technology Stack:**
-   **Node.js:** Version 24
-   **API:** Express 5 with PostgreSQL and Drizzle ORM for database interactions.
-   **Frontend:** React with Vite, styled using Tailwind CSS v4, and enhanced with Framer Motion for animations.
-   **Authentication:** JWT (JSON Web Tokens) with cookie-based storage.
-   **Fonts:** Nunito for UI and Noto Naskh Arabic for Arabic text.
-   **Color Scheme:** Teal/green palette for a child-friendly design.

**Core Architectural Decisions & Features:**

-   **Modular Monorepo Structure:** Separates `api-server` and `mekteb-arapsko-pismo` (React frontend) within `artifacts/`.
-   **Role-Based Access Control:** Distinct routes and functionalities for `admin`, `muallim` (teacher), `roditelj` (parent), and `ucenik` (student) roles.
-   **Content Management:**
    -   `ilmihal_lekcije`, `kvizovi`, and `knjige` tables manage educational content.
    -   **Locked Lessons Principle:** Content marked as `locked` in `ilmihal_lekcije` is protected from accidental overwrites by import scripts or admin edits without explicit force-unlock. Slugs are immutable once created.
    -   **WYSIWYG Editor:** Utilizes TipTap for rich text editing of lessons, supporting image uploads (`POST /api/admin/upload`), custom blocks, and comprehensive formatting.
-   **Gamification System:**
    -   **Hasanat (Credits):** Students earn credits by completing tasks, which unlock game time.
    -   **Game Sessions:** Managed via `game_sessions` table, preventing parallel game sessions and applying server-side duration/score clamping for anti-cheat. Quiz sessions store the generated question pool in `quiz_questions` JSONB column so scoring is fully server-authoritative — the client never sees correct answers and submits only `{questionId, optionIndex}` pairs which the server validates against stored questions. Late-submission attempts (past timer + grace) and oversized answer payloads are rejected.
    -   **Leaderboards:** Scope-filtered (group, mekteb, global) leaderboards for `memory` and `quiz` games, accessible to students while respecting peer privacy.
    -   **Games:** "Pamti Par" (memory game for Arabic letters, client-scored with cheat cap) and "Brzi Kviz" (fast quiz, fully server-scored — no real-time per-question feedback during play; final score revealed at end).
-   **Internationalization (i18n):** Supports BS (default), DE, EN, TR, AR languages. Features include `useLanguage()` hook, IP-based geo-detection for language, localStorage persistence, and automatic RTL support for Arabic.
-   **Admin Panel:** Centralized interface for managing muallims, users, analytics, quiz results, and student assignments.
-   **Security:** Implements CAPTCHA for login/registration, email notifications for new registrations, and robust server-side validation for game mechanics.
-   **Messaging:** A dedicated messaging system (`/api/poruke`) with role-based authorization ensuring secure communication.
-   **Database Schema:** Key tables include `users`, `muallim_profili`, `ucenik_profili`, `roditelj_ucenik`, `grupe`, `prisustvo`, `ocjene`, `poruke`, `mekteb_kalendar`, `plan_lekcija`, `ilmihal_lekcije`, `kvizovi`, `knjige`, `korisnik_napredak`, and `prilozi`.

## External Dependencies

-   **PostgreSQL:** Primary database.
-   **Drizzle ORM:** Object-Relational Mapper for PostgreSQL.
-   **Tailwind CSS v4:** Utility-first CSS framework.
-   **Framer Motion:** Animation library for React.
-   **Multer:** Node.js middleware for handling `multipart/form-data`, used for image uploads.
-   **ipapi.co:** API for IP geolocation used in i18n for language detection.
-   **Nodemailer:** Module for sending emails, pending SMTP configuration for `info@mekteb.net`.
-   **BuyMeACoffee:** Integrated for parent registration with multiple children (likely for subscription/donation linking, though not explicitly stated as payment processing).
-   **Stripe:** Planned for subscription management, but awaiting account setup.