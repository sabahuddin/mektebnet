---
name: Kvizovi po etapama
description: Pravilo za označavanje etapa kvizova i povezivanje cijelog kviza s medaljon-lekcijom.
---

Etapa kviza je opcioni broj unutar već izabranog nivoa. Prikaz je `{etapa}-{nivo}`; svaka etapa predstavlja naredni blok od 10 lekcija.

**Why:** Nivo i oblast nisu dovoljni za zbirne kvizove poslije svakih 10 lekcija, a nivoi nemaju nužno isti broj etapa (Nivo 3 ima 10).

**How to apply:** Gornju granicu uzimaj iz stvarno konfiguriranih medaljona/etapa izabranog nivoa, nikad iz hardkodirane konstante. Prazna etapa i prazna oblast su dozvoljene.

Cijeli postojeći kviz dodjeljuje se konkretnoj Etapi kroz konfiguraciju medaljona; njegova bankovna pitanja ulaze u server-side etapni ispit na medaljon-lekciji.

**Why:** Etapa mora imati vlastiti izvor kvizova, odvojen i od lekcijskog kviza i od Krunisanja, uz server-side bodovanje koje ne vjeruje klijentu.

**How to apply:** Admin bira samo kvizove sa istim nivoom i brojem etape. Pitanja iz više izabranih kvizova dedupliciraju se i spajaju s opcionalnim ručno biranim pitanjima.

Etapni ispit prikazuje sva razriješena pitanja, a prag prolaza određuje konfiguracija konkretnog medaljona.

**Why:** Etapa je cjelovita provjera znanja, ne nasumična vježba iz ograničenog broja pitanja.

**How to apply:** Ne primjenjuj uobičajeni limit pitanja po sesiji. Server provjerava odgovore, zapisuje pokušaj i tek nakon prolaza osvaja medaljon koji otključava napredak.

Krunski kviz je kviz sa postavljenim nivoom i praznom etapom (`etapa=null`); krunisanje ne koristi etapne kvizove.

**Why:** Krunisanje je zaseban završni ispit nivoa. Automatsko uključivanje svih etapnih kvizova miješa dvije različite provjere i onemogućava adminu da odabere namjenske završne kvizove.

**How to apply:** U krunskom pickeru prikaži samo kvizove istog nivoa bez etape. Backend mora odbiti kviz drugog nivoa i svaki kviz kojem je etapa postavljena.

Medaljon/Etapa se otvara na vlastitoj `/medaljon/{slug}` stranici, ne kao sintetička Ilmihal lekcija `medaljon-nivo...`.

**Why:** Sintetičke medaljon-lekcije nisu postojale u bazi, pa je otključan medaljon učeniku prikazivao „Lekcija nije pronađena“ umjesto ispita.

**How to apply:** Mapa linkuje stvarni slug medaljona; ekran učitava `/etape/medaljon/:slug`, prikazuje lekcije etape i `EtapaQuizCard`.