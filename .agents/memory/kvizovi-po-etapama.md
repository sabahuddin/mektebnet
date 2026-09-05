---
name: Kvizovi po etapama
description: Pravilo za označavanje etapa kvizova i povezivanje cijelog kviza s medaljon-lekcijom.
---

Etapa kviza je opcion broj od 1 do 7 unutar već izabranog nivoa. Prikaz je `{etapa}-{nivo}`; svaka etapa predstavlja naredni blok od 10 lekcija.

**Why:** Nivo i oblast nisu dovoljni za zbirne kvizove poslije svakih 10 lekcija, a oblast mora ostati opciona jer etapni kviz može miješati više oblasti.

**How to apply:** Za Nivo 1 prikazuj 1-1 do 7-1, za Nivo 2 prikazuj 1-2 do 7-2 itd. Prazna etapa i prazna oblast su dozvoljene.

Cijeli postojeći kviz dodjeljuje se konkretnoj Etapi kroz konfiguraciju medaljona; njegova bankovna pitanja ulaze u server-side etapni ispit na medaljon-lekciji.

**Why:** Etapa mora imati vlastiti izvor kvizova, odvojen i od lekcijskog kviza i od Krunisanja, uz server-side bodovanje koje ne vjeruje klijentu.

**How to apply:** Admin bira samo kvizove sa istim nivoom i brojem etape. Pitanja iz više izabranih kvizova dedupliciraju se i spajaju s opcionalnim ručno biranim pitanjima.

Etapni ispit prikazuje sva razriješena pitanja, a prag prolaza određuje konfiguracija konkretnog medaljona.

**Why:** Etapa je cjelovita provjera znanja, ne nasumična vježba iz ograničenog broja pitanja.

**How to apply:** Ne primjenjuj uobičajeni limit pitanja po sesiji. Server provjerava odgovore, zapisuje pokušaj i tek nakon prolaza osvaja medaljon koji otključava napredak.