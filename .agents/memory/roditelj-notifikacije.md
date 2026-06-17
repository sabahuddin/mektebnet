---
name: Roditeljske notifikacije — opseg i pravila
description: Koji događaji šalju roditelju obavijest i zašto prisustvo namjerno NE šalje
---

Roditelj (odobrena `roditelj_ucenik` veza, status "approved") dobija in-app poruku
+ push (`notifyApprovedRoditelji` u muallim.ts) SAMO za:
- muallim poruku (single `/poruke` i bulk `/poruke/bulk`),
- novu zadaću djeteta (`POST /muallim/zadace`),
- novu ili promijenjenu ocjenu djeteta (`POST /muallim/ocjene` i grading PUT
  `/muallim/zadace/:id/status/:ucenikId`).

**Prisustvo NAMJERNO ne šalje obavijest** (`POST /muallim/prisustvo`).

**Why:** korisnik je eksplicitno tražio da prisustvo bude samo evidencija — roditelji
bi inače dobijali obavijest svaki put kad muallim spremi prisustvo. Ako neko ubuduće
"popravi" ovo misleći da je propust, to je regresija, ne bug.

**How to apply:**
- Grading PUT šalje notifikaciju tek nakon uspješnog sync-a u `ocjeneTable`
  (flag `ocjeneSyncOk`) i samo kad `ocjenaVal !== prevOcjena` — da roditelj ne dobije
  obavijest za ocjenu koja se neće pojaviti u njihovom panelu, niti duplikat pri
  ponovnom spremanju iste ocjene.
- Sve notifikacije su best-effort: pozadinske IIFE / `.catch()`, nikad `await` u
  glavnom request toku, nikad ne bacaju (push greška se samo loguje).
- Ocijenjena zadaća "prelazi" u Ocjene: backend upiše red u `ocjeneTable`
  (kategorija "zadaća", `zadaca_id`); frontend roditelj.tsx filtrira iz liste Zadaća
  sve čiji `id` postoji u `ocjene.zadacaId` (Set lookup) — drži oba kraja usklađena.
