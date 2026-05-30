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
