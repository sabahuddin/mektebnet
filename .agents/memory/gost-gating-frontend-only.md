---
name: Gost-gating je frontend-only
description: Kako se "gost" pristup (lekcije/kvizovi) ograničava i zašto roditelj=gost ne traži backend izmjene
---

Gating "gost dobija samo prvih 5 lekcija + 1 kviz" je **frontend-only**. Backend
`/content/ilmihal/:slug` gate-uje SAMO rolu `ucenik`; gosti (bez tokena) i sve
ostale role dobiju puni sadržaj iz API-ja, a frontend ih reže. `/content/kvizovi`
ne gate-uje nikog server-side.

**Why:** Kada se uvodila rola `roditelj` kao "gost svuda osim panela", izgledalo je
da treba i backend gate. Ne treba — pošto backend već ne gate-uje goste, dovoljno je
da roditelj putuje istim `isGuestLike` putem na frontu (`!user || role==="roditelj"`)
kao neprijavljeni posjetilac. Tako roditelj = gost bez ijedne backend izmjene i bez
diranja DB role.

**How to apply:** Za "tretiraj rolu X kao gosta": dodaj je u `isGuestLike` na svim
frontend gate tačkama (mapa lekcija, lista/stranica lekcije, lista/stranica kviza).
Ne diraj backend osim ako se traži prava sigurnosna brava (tada gate i goste). Igrice
su poseban slučaj — već su strože (`role !== "ucenik"` blokira sve osim učenika).

**Zamka — write akcije:** Prijavljena "gost-like" rola (npr. roditelj) IMA token, pa
write-akcije koje pravi gost ne može (markComplete/heartbeat/quizPassed/kviz-rezultat)
i dalje fire-aju i upisuju napredak/hasanat. Vizuelni gate nije dovoljan — dodaj
`isGuestLike` i na guardove write-funkcija da gost-like rola ostane read-only kao
neprijavljeni gost. Backend gating SAMO za tu rolu je pogrešan: učinio bi je strožijom
od gosta.
