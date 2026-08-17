---
name: Git push na mektebnet projektu
description: Kako pushati na GitHub (sabahuddin/mektebnet) i zašto timing i token zahtijevaju oprez.
---

## Token: koristi GITHUB_TOKEN secret, ne remote URL
Remote `github` ima hardkodiran personal access token u URL-u koji je istekao i vraća 401. `git push github main` ne radi, a Replit askpass ne može odgovoriti (terminal prompts disabled). Koristi `GITHUB_TOKEN` secret direktno:

```bash
timeout 60 git push "https://x-access-token:${GITHUB_TOKEN}@github.com/sabahuddin/mektebnet.git" main 2>&1 | sed "s/${GITHUB_TOKEN}/***/g"
```

**Why:** Korisnik je potvrdio da `GITHUB_TOKEN` radi a token u remote URL-u ne. Ne mijenjaj remote config (korisnik ga drži tako namjerno). Uvijek pazi da token ne procuri u log.

Ako `http.extraheader` vrati `invalid credentials`, push radi kroz privremeni `GIT_ASKPASS` helper koji vraća `x-access-token` kao username i čita `GITHUB_TOKEN` samo za password; poslije obriši helper.

## Git blokada u glavnom agentu (build mode)
Okruženje sada odbija SVE destruktivne git komande u glavnom agentu — uključujući `git commit` (čak i u lancu `git add && git commit && git push <url>`, blokada pukne na commitu). NIKAD ne pokušavaj ručni `git commit`; lokalni commit se radi automatski kao Replit checkpoint na kraju turna.

**How to apply:** Ne stavljaj `git commit` u lanac. Push radi SAMO push-only komandom (naredba iznad) i to na POČETKU sljedećeg turna (kad je auto-commit prethodnog turna već nastao). Ako i push-only bude blokiran, delegiraj git operaciju na background Project Task (ili oslon na već predložene follow-up taskove "Git push + Coolify redeploy").

## KRITIČNO: timing — push može propustiti izmjenu
Replit checkpoint commit za izmjene nastaje tek na KRAJU turna ("Loop ended"), NE odmah nakon edita. Ako pushaš u istom turnu odmah nakon file edita, push šalje samo *prethodni* commit — nova izmjena ostane uncommitted i ne ode na GitHub.

**How to apply:** Pushaj na POČETKU sljedećeg turna (kad je prethodni edit već checkpointan), ili re-pushaj. Ne vjeruj push output-u slijepo — UVIJEK verifikuj:
- `git --no-optional-locks log --oneline -3` (lokalni HEAD)
- `git ls-remote "https://x-access-token:${GITHUB_TOKEN}@github.com/sabahuddin/mektebnet.git" main` (remote HEAD)
- da remote HEAD == lokalni HEAD; opcionalno `git show <head>:put/do/fajla | grep -c <očekivani sadržaj>`.

## Coolify
Push triggeruje deploy preko Coolify-ja, ali Coolify uvijek treba RUČNI redeploy nakon push-a (self-hosted, mekteb.net). Napomeni korisniku da uradi redeploy.
