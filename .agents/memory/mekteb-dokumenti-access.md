---
name: Mekteb dokumenti — privatni fajlovi vs javni uploads
description: Zašto se mekteb PDF dokumenti NE smiju servirati preko javnog /uploads
---

Mekteb-nivo PDF dokumenti (pravila, kućni red...) moraju biti vidljivi SAMO
članovima mekteba (glavni muallim, učenici, roditelji povezanog djeteta).

**Pravilo:** ne servirati ih preko javnog static `/uploads` (`/api/uploads`) mounta.
- Čuvaju se u poddirektoriju `uploads/mekteb-dokumenti/` koji je BLOKIRAN (403) u
  static guard-u (app.ts `requireH5pAuth`).
- Serviraju se isključivo kroz autorizovane API rute `/<role>/.../dokumenti/:id/file`
  koje provjeravaju role + pripadnost mektebu, pa stream-uju fajl.
- Frontend ih NE otvara običnim `<a href>` — koristi `openAuthorizedFile()` (fetch s
  Bearer → blob → window.open).

**Why:** static `/uploads/*` je javan po dizajnu (lekcijski PDF/slike iz contentHtml-a
moraju raditi out-of-context). Direktni link bi probio tenant granicu — roditelj/učenik
iz drugog mekteba bi mogao otvoriti tuđa interna pravila preko poznatog URL-a (IDOR).

**How to apply:** svaki novi "samo-za-mekteb" fajl ide u blokirani poddirektorij +
autorizovana ruta, nikad u korijen javnog uploads foldera.
