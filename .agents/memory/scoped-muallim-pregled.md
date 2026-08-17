---
name: Scoped pregled muallima
description: Pravilo za pregled podataka drugog muallima iz glavnog muallimskog panela
---

Glavni muallim treba pregled drugog muallima otvoriti kroz eksplicitni read-only `muallimId` scope, a ne lažiranjem login identiteta.

**Why:** Tako isti panel može prikazati grupe, učenike, statistiku, kalendar, izvještaje i roditelje odabranog muallima, dok backend zadržava jasnu provjeru da je odabrani muallim iz istog mekteba i da se ništa ne može mijenjati iz previewa.

**How to apply:** Svaki novi endpoint koji se koristi u tom pregledu mora prihvatiti isti scope ili eksplicitno odbiti preview; frontend u read-only modu treba sakriti akcije koje mijenjaju podatke.

## Scope se izvodi iz asinkronog konteksta — ne dohvataj prije nego stigne

Isti `muallimId` scope određuje i lični pregled glavnog muallima ("Moje grupe"), a zna li se da je korisnik glavni muallim saznaje se tek iz asinkronog info poziva. Zato svaki fetch koji zavisi od scope-a mora čekati da taj kontekst bude učitan, i keš mora biti očišćen kad se scope promijeni.

**Why:** Bez toga prvi poziv krene bez scope-a, backend legitimno vrati agregat cijelog mekteba, a "fetch samo ako podatak još ne postoji" guard zaključa taj pogrešan rezultat — korisnik u "Moje grupe" vidi brojke cijelog mekteba.

**How to apply:** Drži zaseban "kontekst učitan" flag u uslovu fetch efekta i resetuj keširane scope-ovisne podatke na promjenu scope-a. Naslovi i dugmad (npr. "Cijeli mekteb" vs "Moje grupe", štampanje svih učenika) također moraju pratiti aktivni scope, inače tekst laže i kad su podaci tačni.

## Djeci-komponentama prosljeđuj izvedeni scope, ne sirovi "preview" izbor

Postoje dvije različite vrijednosti: izbor "gledam drugog muallima" (prazan u ličnom pregledu) i izvedeni efektivni scope (koji u ličnom pregledu glavnog muallima pokazuje na njega samog). Pod-tabovi moraju dobiti **izvedeni** scope.

**Why:** Kad tab dobije samo "preview" izbor, u "Moje grupe" pošalje zahtjev bez `muallimId`, backend legitimno vrati cijeli mekteb, i tab pokaže npr. sve roditelje džemata pored 4 vlastite grupe. Read-only zastavica se i dalje izvodi iz preview izbora, ne iz scope-a.

**How to apply:** Kod svakog pod-taba provjeri da prop za scope dolazi iz izvedene vrijednosti; read-only ostaje vezan za preview izbor.