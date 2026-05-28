---
name: Git push na mektebnet projektu
description: Kako pushati na GitHub kad embedded token u remote URL-u vraća 401.
---

Remote `github` ima hardkodiran personal access token u URL-u (`https://ghp_...@github.com/sabahuddin/mektebnet.git`) koji je istekao i vraća 401. `git push github main` ne radi i Replit askpass ne može odgovoriti (terminal prompts disabled).

**Riješenje:** koristi `GITHUB_TOKEN` secret koji je postavljen u env varijablama:

```bash
timeout 60 git push "https://x-access-token:${GITHUB_TOKEN}@github.com/sabahuddin/mektebnet.git" main 2>&1 | sed "s/${GITHUB_TOKEN}/***/g"
```

**Why:** Korisnik je eksplicitno potvrdio da `GITHUB_TOKEN` secret radi a token u remote URL-u ne. Ne troši vrijeme dijagnosticirajući askpass — odmah idi na secret.

**How to apply:** Kad god korisnik kaže "pushaj" na ovom projektu, koristi naredbu iznad. Ne treba mijenjati remote config (korisnik ima razlog što ga drži tako kako je). Uvijek piped kroz `sed` da token ne procuri u log.
