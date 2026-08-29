---
name: Otključavanje lekcija — dvije odvojene brave
description: Pravilo pristupa lekcijama: prijavljeni učenik ima sva tri nivoa, a blokiraju samo eksplicitni preduvjeti; mapa i detail moraju ostati usklađeni.
---

# Otključavanje lekcija ima DVIJE nezavisne brave

Pristup ilmihal-lekciji kontrolišu DVA odvojena gate-a koja ne dijele logiku:

1. **Mapa** (`nivo1-mapa.tsx`): za prijavljenog učenika svaka redovna lekcija je
   otključana, osim ako ima eksplicitne `uvjetiIds` preduvjete koji nisu završeni.
   Medaljoni ostaju zasebne etape sa svojim pravilima.
2. **Stranica lekcije** (`ilmihal-lekcija.tsx`, gate u GET `/content/ilmihal/:slug` `.then`):
   mora koristiti isto pravilo kao mapa. Za redovne lekcije ne postoji sekvencijalni
   limit po `redoslijed`; backend provjerava samo eksplicitne preduvjete.

**Simptom "Nivo 2/3 ili kasnija lekcija je zaključana":** raniji tok je imao
sekvencijalno otključavanje blokova i dodatni uslov prethodnog krunisanja. To više ne
važi za prijavljenog učenika: sva tri nivoa su dostupna odmah, a samo eksplicitni
preduvjeti lekcije mogu blokirati pristup.

**Why:** Dogovoreni obrazovni tok dopušta učeniku da sam bira bilo koju lekciju iz
sva tri nivoa; preduvjeti su namjerni izuzetak, dok krunisanje i medaljoni nisu
globalna brava za redovne lekcije.

**Riješeno:** `isLekcijaUnlocked` u `src/lib/lekcija-unlock.ts` koristi se za
per-lekcija provjeru na mapi i stranici. API mapa više ne blokira Nivo 2/3 preko
prethodnog krunisanja, a lista svih lekcija više ne koristi "prva nezavršena" bravu.
Gost/roditelj i dalje imaju javni limit od prvih 5 lekcija.

**How to apply:** NE vraćaj tvrdi `redoslijed`-limit, blok po medaljonima ili prethodno
krunisanje kao globalnu bravu za redovne lekcije učenika. Nove posebne izuzetke dodaj
kao eksplicitne preduvjete i drži mapu, listu i detail rutu usklađenim.

**Sporedno (nije glavni uzrok 11/12):** lekcija se broji kao završena tek nakon strogog
anti-cheat gate-a (≥300s aktivnog čitanja; 30s za intro slugove; ≥85% skrol; otvorene sve
sekcije; i mini-kviz "Provjeri znanje" tačno riješen — SVE prve Nivo-1 lekcije imaju kviz).
Zato `completedCount` lako zaostaje za onim što učenik misli da je "uradio".
