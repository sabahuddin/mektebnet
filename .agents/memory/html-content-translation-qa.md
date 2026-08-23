---
name: Dugi HTML sadržaj — siguran AI prijevod
description: Kako prevesti velike lekcije bez djelimičnog prijevoda ili promjene HTML strukture.
---

# Dugi HTML sadržaj — prevodi tekstualne čvorove, ne cijeli dokument

**Pravilo:** Za duge lekcije ne šalji kompletan HTML modelu. Lokalno izdvoji tekst između tagova, prevedi ga u kratkim indeksno-usmjerenim paketima i ponovo sastavi originalni HTML bez mijenjanja tagova, atributa ili njihovog redoslijeda. Nakon upisa potvrdi hash izvora i istu sekvencu HTML tagova.

**Why:** Model može vratiti dio dugog HTML-a na bosanskom ili neznatno promijeniti markup, iako odgovor prođe provjeru minimalne dužine. Takav overlay je vidljiv korisniku, a može i pokvariti interaktivnu lekciju.

**How to apply:** Za završnu kontrolu traži doslovno neprevedene bosanske tekstualne čvorove, ne samo jednak cijeli dokument. Bosanski prijevodi ajeta, dova i citata se prevode; samo arapsko pismo i čista arapska transliteracija ostaju netaknuti.