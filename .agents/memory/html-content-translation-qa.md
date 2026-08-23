---
name: Dugi HTML sadržaj — siguran AI prijevod
description: Kako prevesti velike lekcije bez djelimičnog prijevoda ili promjene HTML strukture.
---

# Dugi HTML sadržaj — prevodi tekstualne čvorove, ne cijeli dokument

**Pravilo:** Za duge lekcije ne šalji kompletan HTML modelu. Lokalno izdvoji tekst između tagova, prevedi ga u kratkim indeksno-usmjerenim paketima i ponovo sastavi originalni HTML bez mijenjanja tagova, atributa ili njihovog redoslijeda. Nakon upisa potvrdi hash izvora i istu sekvencu HTML tagova.

**Why:** Model može vratiti dio dugog HTML-a na bosanskom ili neznatno promijeniti markup, iako odgovor prođe provjeru minimalne dužine. Takav overlay je vidljiv korisniku, a može i pokvariti interaktivnu lekciju.

**How to apply:** Za završnu kontrolu traži doslovno neprevedene bosanske tekstualne čvorove, ne samo jednak cijeli dokument. Bosanski prijevodi ajeta, dova i citata se prevode; samo arapsko pismo i čista arapska transliteracija ostaju netaknuti.

## Velika slova i miješani čvorovi

**Pravilo:** Prijevod ne smatraj gotovim samo zato što postoji overlay i hash izvora odgovara. Posebno provjeri čvorove pisane velikim slovima te naslove koji uz bosanski opis sadrže naziv dove ili transliteraciju. Prevedi bosanski dio, a sačuvaj samo čistu transliteraciju.

**Why:** Model zna pogrešno ostaviti bosanske naslove poput „Dova za znanje” ili „Pitanja za razgovor” jer ih tumači kao naziv. Kratke čestice koje se pojavljuju i u transliteraciji mogu dati lažni signal da je čvor bosanski.

**How to apply:** Prevodi tekstualne čvorove u malim paketima i ponovi strogo samo svaki nepromijenjeni bosanski čvor. QA mora razlikovati arapsko pismo i čistu transliteraciju od miješanog teksta; odbij prijevod koji uvodi novi počasni oblik, arapsko pismo ili engleski sadržaj u njemački rezultat.