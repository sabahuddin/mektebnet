---
name: Jedan roditelj po učeniku — atomska zaštita
description: Pravilo kako održati invarijantu jednog odobrenog roditelja uz paralelne zahtjeve.
---

Pravilo **1 učenik = 1 odobren roditelj** mora biti zaštićeno PostgreSQL
parcijalnim jedinstvenim indeksom nad učenikom za redove sa statusom
`approved`. Samo provjera u aplikaciji prije upisa nije dovoljna.

**Why:** Dva paralelna zahtjeva mogu oba pročitati da nema odobrenog roditelja,
pa svaki zasebno upiše vezu. Baza je jedino mjesto koje može atomarno zatvoriti
taj race condition.

**How to apply:** Pri promjeni odobravanja, povezivanja ili kreiranja roditelja
zadrži indeks, prije njegove izrade deterministički uskladi stare duplikate i
presretni njegov unique-violation kao korisnički 409. Pokrij paralelne zahtjeve
regresionim testom.