---
name: Jezik "miješanje" sadržaja — remount na promjenu jezika
description: Zašto se nakon promjene jezika sadržaj miješa (npr. njemački meni + albanska lekcija) i kako je riješeno
---

Simptom: korisnik odabere npr. DE, nav/UI se prevede, ali DB sadržaj (lekcija)
ostane na prethodnom jeziku (npr. albanski), dok drugi dio iste stranice (kviz)
bude bosanski. To je "miješanje".

**Uzrok NIJE backend.** `lib/content-translatable.ts` overlay je korektan: za
`X-Lang=de` dohvaća SAMO `de` redove iz `content_prijevodi`, fallback na bosanski;
nikad ne servira drugi jezik. Uzrok je frontend lifecycle: skoro sav sadržaj se
dohvaća preko `apiRequest` u `useEffect`-ima čiji dependency je ID resursa, a NE
jezik (samo 2 fajla koriste React Query; ostalo je apiRequest+useEffect). UI
tekstovi su reaktivni preko `t()`, ali već učitan DB sadržaj se ne refetch-a kad
se jezik promijeni → ostane stari jezik. `X-Lang` se čita iz localStorage u
`lib/api.ts` u trenutku fetcha.

**Fix:** u `App.tsx` cijelo route-stablo se REMOUNTUJE na promjenu jezika
(`<Router key={lang} />` kroz `AppRoutes` koji čita `useLanguage()`), pa svi
mount-time `useEffect` fetcheri ponovo pucaju s novim `X-Lang`. Trade-off: gubi
se in-progress lokalni state aktivne stranice (prihvatljivo za svjesnu akciju
"promijeni jezik").

**Why:** ne oslanjaj se na `queryClient.invalidateQueries()` za jezik —
React Query pokriva samo 2 ne-content upita; sav prevodivi sadržaj ide mimo njega.
**How to apply:** svaka nova jezik-ovisna stranica automatski je pokrivena dok
sadržaj dohvaća na mountu; vidljivo na mekteb.net tek nakon push + Coolify redeploy.
