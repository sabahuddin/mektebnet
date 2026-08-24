---
name: Njemački overlayji i hash izvora
description: Kako hash-zaštićeni bundlani njemački prijevodi reagiraju na izmjene izvornog HTML-a lekcije.
---

Bundlani njemački prijevod primjenjuje se samo kada SHA-256 hash trenutnog bosanskog polja odgovara njegovom `sourceHash`. Ako se sadržaj lekcije ili njen generisani pripremni blok izmijeni, naslov može ostati preveden dok `content_html` tiho padne nazad na bosanski.

**Why:** Zaštita od pogrešnog prijevoda namjerno preskače overlay kad izvor više nije isti; inače bi stari prijevod mogao prepisati nov, nastavnički izmijenjen sadržaj.

**How to apply:** Nakon svake produkcijske izmjene izvornog HTML-a, provjeri detalj rute s `X-Lang: de`. Za već pregledan prijevod osvježi `sourceHash` iz aktuelnog izvora i uskladi HTML omotač/atribute prije pakovanja; tek tada će startup bezbjedno upisati overlay.