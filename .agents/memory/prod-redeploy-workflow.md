---
name: Korisnik uvijek gleda produkciju (Coolify redeploy obavezan)
description: Sve promjene postaju vidljive tek nakon Coolify redeploya; korisnik nikad ne testira dev preview.
---

Korisnik **uvijek i jedino** gleda produkciju (mekteb.net). Nikad ne gleda Replit dev preview.

**Why:** Više puta je javio "i dalje je isto" nakon što je kod ispravljen i pushan — jer produkcija
vrti staru verziju dok se ne pokrene Coolify redeploy. Replit preview origin nije mekteb.net, pa push
notifikacije/OneSignal i sve ostalo testira samo na produkciji.

**How to apply:**
- Kad god napravim promjenu frontenda/backenda, ona NIJE vidljiva korisniku dok se Coolify ne redeploy-a.
- Coolify redeploy korisnik radi ručno (ja nemam pristup). Uvijek mu eksplicitno napomeni: "pushano je,
  uradi Coolify redeploy da se vidi na mekteb.net".
- Ako korisnik kaže "ne radi" / "isto je" odmah nakon promjene, prvo provjeri je li produkcija redeployana,
  ne pretpostavljaj bug u kodu.
- Za debug produkcije koristi prod bazu (self-hosted) kao izvor istine, ne dev DB.
- **Prije nego kažeš "uradi redeploy", provjeri da github/main STVARNO sadrži fix.** Lokalni HEAD ume biti
  10+ commitova ispred `github/main` (Coolify deploya s github/main). Provjeri ciljanim:
  `git show github/main:<putanja> | grep <marker>` — ako je 0, fix nije pushan i redeploy sam neće pomoći
  (treba push PA redeploy).
- **Code-vs-schema izolacija za prod 500:** ako feature radi u dev a 500 na prod, pokreni tačan niz INSERT-a
  protiv prod baze unutar `DO $$ ... RAISE EXCEPTION 'PROBE_OK' END $$;` (sve se rollbackuje, ništa ne ostaje).
  Prođe li probe → baza je dobra, uzrok je nedeployan/star kod, ne schema.

## Build cache na self-hosted Coolify serveru
Coolify redeployi mogu nagomilati Docker build cache do te mjere da Redis ne
može zapisati RDB snimak, pa i sam Coolify dashboard vraća MISCONF/500.

**Why:** produkcijski host je imao gotovo pun disk, a `docker system df` je
pokazao neiskorišten build cache; nakon čišćenja cachea disk je opet imao
dovoljno slobodnog prostora. Status vanjskog Object Storagea nije dokaz uzroka.

**How to apply:** kod Coolify Redis MISCONF prvo read-only provjeri `df -h /`
i `docker system df`. Ako build cache ima veliki reclaimable iznos, korisniku
objasni posljedice prije `docker builder prune -a` (naredni build je sporiji);
ne predlaži brisanje volumena niti restart Redis-a bez provjere rizika po podatke.

Na ovom hostu Docker CLI prikazuje `--max-used-space` za buildx prune, ali
ugrađeni BuildKit odbija tu opciju (traži v0.17+, host je stariji). Ograniči
periodično čišćenje po starosti cachea, ne po ciljnoj veličini, dok se BuildKit
ne nadogradi. Korisnik je potvrdio da probna disk upozorenja preko već
podešenog SMTP-a aplikacije stižu na e-mail.

**Why:** CLI pomoć i mogućnosti daemon-side BuildKit-a nisu usklađene; cron
koji se oslanja na opciju iz pomoći ne bi oslobodio ništa. Probno SMTP
prihvatanje samo po sebi nije dokaz da je poruka stigla.

**How to apply:** prije budućih promjena server maintenance-a probaj tačnu
komandu na hostu, provjeri log i isporuku upozorenja kod primaoca; ako
aplikacijski kontejner nije dostupan, njegov SMTP ne može slati upozorenja.
