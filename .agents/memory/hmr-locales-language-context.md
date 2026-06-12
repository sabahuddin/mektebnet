---
name: HMR locales → language.tsx tranzijentne greške
description: Lažne "useLanguage must be used within LanguageProvider" greške pri izmjeni locales/*.json
---

Izmjena `src/locales/*.json` (npr. nakon `translate-i18n.ts`) okida Vite HMR na i18n.ts → language.tsx. Pošto language.tsx izvozi i `LanguageProvider` i `useLanguage` hook, Fast Refresh ne može osvježiti modul ("Could not Fast Refresh: useLanguage export is incompatible") i nakratko baci "useLanguage must be used within LanguageProvider" + "Invalid hook call" u konzoli prije punog reloada.

**Why:** Tranzijentno stanje tokom HMR invalidacije — provider se nakratko odmontira dok djeca (AppRoutes) još pozivaju hook. Nakon punog reloada nestane.

**How to apply:** NE jurit ovu grešku kao pravi bug ako se pojavila samo nakon izmjene locales/json ili language.tsx. Potvrdi svježim reloadom (screenshot/hard refresh) — čista konzola = zdravo. Pravi bug bi se vidio i nakon punog reloada.
