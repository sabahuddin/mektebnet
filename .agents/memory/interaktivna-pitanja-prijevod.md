---
name: Prijevod inline interaktivnih pitanja (dragDrop/markWords)
description: Strukturne zamke pri prevođenju kvizovih dragDrop/markWords pitanja i content-addressed overlay obrazac.
---

Inline interaktivna pitanja (dragDrop/markWords) žive u `kvizovi.pitanja` (JSONB) i NEMAJU red u
pitanja_banci, pa se prijevodi čuvaju content-addressed u `content_prijevodi` (polje = hash kanonskog
bs pitanja). Serve i generaciona skripta MORAJU dijeliti isti hash+validator (pure lib, bez db
importa) — inače hash drift tiho ruši svaki pogodak na bs fallback.

**Content-addressing je otporno na reorder, ne na edit.** Izmijeni li se pitanje → drugi hash → nema
pogotka → bs fallback (namjerno). Validacija je druga brava: strukturno nekompatibilan/stari payload
pada na bs. Ali validacija je SAMO strukturna — semantički pogrešan AI prijevod prolazi; visokovrijedne
kvizove treba ljudski spot-check.

**Zamka 1 — dragDrop "DROP" pozicija je jezički zavisna.** Bosanski stavlja prazninu na KRAJ, ali npr.
EN red riječi je gura u SREDINU rečenice. Validacija NE smije tražiti istu dužinu templatea ni iste
DROP pozicije — provjeri samo da je BROJ "DROP" tokena isti (= broj praznina = correct.length).
**Why:** prestrogo "ista dužina + iste pozicije" je tiho rušilo SAMO EN (sq/de slučajno zadržali
kraj-poziciju) → bs fallback za par pitanja.

**Zamka 2 — markWords `incorrect` numerički indeksi znaju biti VAN granica** (pre-existing pokvareni bs
podaci, npr. `incorrect:[8]` uz 8 riječi/indeksi 0–7). `words[i]` → undefined → prazan skup. NE rušiti
prijevod; kad je skup prazan, neka model SAM nađe pogrešnu riječ iz `explanation` (jasno kaže grešku).
Prevedeni `incorrect` su STRINGOVI ⊆ `words` (klijentski ugovor; numerički oblik je bs bug, NE dirati).
Ograničenje ugovora: klijent radi `incorrect.includes(word)` pa ne razlikuje višestruke pojave iste
riječi — pre-existing, ne regresija.

**getLang gate:** serve prevodi samo za jezike u backend `SUPPORTED` (content-translatable.ts); mora
imati sq/de/en. Skrivanje jezika sa switchera je čisto frontend (SUPPORTED + LANG_ORDER); ostaviti
tr/ar u backend SUPPORTED je bezopasno (frontend ih ne šalje, nije sigurnosna granica).
