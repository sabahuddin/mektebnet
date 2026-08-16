---
name: OneSignal env na Coolify
description: Kako je konfigurisan OneSignal App ID na produkciji i zamke build-time vs runtime varijabli
---

- Coolify env vari po defaultu NISU dostupne pri buildu — `VITE_*` varijabla mora biti eksplicitno označena kao "Build Variable", inače se ne upeče u frontend bundle (toggle ostaje "nisu konfigurisane").
- **Why:** korisnik je dodao `VITE_ONESIGNAL_APP_ID` samo runtime → frontend build imao prazan ID mjesecima.
- **How to apply:** backend endpoint `GET /api/push/config` (javni, u main routeru — NE u auth-zaštićenom push routeru!) vraća App ID kao runtime fallback; čita `ONESIGNAL_APP_ID || VITE_ONESIGNAL_APP_ID`. Frontend fetchuje ako je build-time ID prazan.
- Express zamka: `router.use(requireAuth)` hvata i rute definisane PRIJE njega u istom Routeru — javne rute idu u parent router.
- Slanje pusheva sa servera traži i `ONESIGNAL_REST_API_KEY` na Coolify (runtime).
- PWA sukob: VitePWA workbox SW drži scope `/` — OneSignal worker MORA na poseban scope (`serviceWorkerParam: { scope: "/push/onesignal/" }`), inače se SW-ovi pregaze i subscribe tiho pada.
- OneSignal `init()` zna baciti grešku NAKON što interno postavi "initialized" flag → retry baca "SDK already initialized"; tretiraj tu poruku kao uspješan init i nastavi.
- Klik na toggle mora retry-ati init i prikazati stvarnu grešku (lastPushError) — tihi `return false` je danima maskirao pravi uzrok.
