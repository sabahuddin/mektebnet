---
name: Njemački overlayji i hash izvora
description: Kako hash-zaštićeni bundlani njemački prijevodi reagiraju na izmjene izvornog HTML-a lekcije.
---

Bundlani njemački prijevod primjenjuje se samo kada SHA-256 hash trenutnog bosanskog polja odgovara njegovom `sourceHash`. Ako se sadržaj lekcije ili njen generisani pripremni blok izmijeni, naslov može ostati preveden dok `content_html` tiho padne nazad na bosanski.

**Why:** Zaštita od pogrešnog prijevoda namjerno preskače overlay kad izvor više nije isti; inače bi stari prijevod mogao prepisati nov, nastavnički izmijenjen sadržaj.

**How to apply:** Nakon svake produkcijske izmjene izvornog HTML-a, provjeri detalj rute s `X-Lang: de`. Za već pregledan prijevod osvježi `sourceHash` iz aktuelnog izvora i uskladi HTML omotač/atribute prije pakovanja; tek tada će startup bezbjedno upisati overlay.

Ručne ispravke prevedenog HTML-a u produkciji ne smije poništiti svaki restart samo zato što bundlani overlay i dalje ima isti hash bosanskog izvora. Paket je početno popunjavanje ili zamjena kada se izvor izmijeni, a ne autoritet nad kasnije uređenim prijevodom.

**Why:** Restart nakon popravljanja bosanske transkripcije u EN/DE prijevodima inače bi ponovo upisao stari njemački HTML iz paketa.

**How to apply:** Pri izmjeni logike bundlovanih overlayja sačuvaj noviji produkcijski prijevod kada je hash izvora nepromijenjen; za namjernu novu reviziju prijevoda istog izvora treba poseban put primjene, ne slijepo startup prepisivanje.