# Mekteb.net — Islamska edukativna platforma

## Overview

Mekteb.net is an independent, self-hosted Islamic educational platform designed to replace traditional systems. It offers a comprehensive suite of features for students, parents, and teachers (muallims), focusing on Islamic education with gamified learning and administrative tools.

**Key Capabilities:**
- **Gamified Learning:** Arabic script learning, Ilmihal lessons, and quizzes with a "Hasanat" credit system for game time.
- **Administrative Tools:** Muallim Panel for student/group management, attendance, grades, and lesson plans. Parent Panel for tracking children's progress.
- **Content:** Over 231 Ilmihal lessons, 43 quizzes with 1120+ questions, and a Reading Room with 14 books.
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
- **Navigation:** Features a main navigation and a "Moja košnica" dropdown for profile-specific items, including "Popravi saće" and "Misije". A "Sufara" module is planned and shown as "coming soon."
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