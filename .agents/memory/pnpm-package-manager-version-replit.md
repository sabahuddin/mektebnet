---
name: pnpm packageManager verzija na Replitu
description: Kako spriječiti rekurzivnu pnpm samoinstalaciju kada packageManager traži noviju verziju od Replit Nix modula.
---

Kad `package.json` zakuca noviji pnpm od verzije dostupne u Replit Nix modulu, drži `manage-package-manager-versions=false` u `.npmrc`.

**Why:** pnpm 10.26.1 je pokušavao sam instalirati pnpm 10.33.0 kroz vlastiti `pnpm add pnpm@...`, što je rekurzivno pokretalo isti mehanizam dok workflowi nisu pali zbog iscrpljenih threadova.

**How to apply:** Ne uklanjaj zakucanu verziju potrebnu CI-ju/Coolifyju. Isključi samo pnpm-ovo automatsko mijenjanje package-manager verzije u projektu; Replit tada koristi svoj Nix pnpm, a CI/Coolify i dalje mogu pokrenuti zakucanu verziju.