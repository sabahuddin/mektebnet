---
name: SMTP na produkciji (Coolify)
description: Port, async ponašanje i timeouti za slanje mailova; kako izbjeći da request visi.
---

# SMTP na produkciji (Coolify)

## Port
Coolify hosting blokira port **465** (implicitni SSL). Koristi **587** (STARTTLS).
`secure` mora biti `false` na 587. Na 465 konekcija visi indefinitno jer je port blokiran.

## Async ponašanje — kada NE awaitati
Mailovi koji NISU dio korisničkog odgovora (npr. registracijske notifikacije adminu)
moraju biti **fire-and-forget** (`sendX(...).catch(...)`, bez `await`). Ako se awaitaju u
request handleru a SMTP je spor/nedostupan, request visi i korisnik čeka.

**Why:** zabilježen produkcijski incident — awaitani mail je objesio request kad je SMTP
zapeo (tada zbog blokiranog 465).

## Kada SMIJEŠ awaitati (kontakt forma)
Kontakt forma awaita `sendEmail` da bi vratila **502** na neuspjeh (umjesto lažnog
"poruka poslana"). Da awaitanje bude sigurno, transporter ima **ograničene timeoute**
(connectionTimeout/greetingTimeout/socketTimeout, ~10-15s) — ako SMTP zakaže, send brzo
padne u `false` umjesto da visi do nodemailer defaulta (~2 min).

**How to apply:**
- `sendEmail()` po ugovoru **nikad ne baca** — vraća `false` na grešku/nekonfigurisan SMTP.
  Pozivalac koji želi javiti korisniku MORA provjeriti povratnu vrijednost.
- Za pozadinske mailove: fire-and-forget, ignoriši rezultat.
- Za mailove čiji ishod korisnik vidi: smiješ awaitati JER transporter ima timeoute;
  na `false` vrati 5xx s porukom da piše direktno na info@mekteb.net.
