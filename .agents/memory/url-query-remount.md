---
name: URL query remount
description: Wouter pathname i search tretira kao odvojene izvore promjene, pa query-only navigacija inače zadržava lokalno React stanje.
---

Wouter u ovoj aplikaciji prati pathname i query string odvojeno. Promjena samo query parametara (`tab`, `grupaId`, učenik ili filter) zato može ostaviti istu komponentu montiranom i zadržati prethodni izbor.

**Why:** korisnik je više puta dobijao prikaz prethodno izabranog konteksta iako se URL promijenio.

**How to apply:** za aplikacijske rute ključ treba sastaviti od jezika, pathname-a i search-a, tako da query-only navigacija remountuje aktivnu stranicu. Ne oslanjati se samo na `useLocation()` za query promjene.