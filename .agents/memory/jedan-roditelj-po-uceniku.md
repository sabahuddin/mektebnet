---
name: Jedan roditelj po učeniku (invarijanta)
description: Učenik smije imati NAJVIŠE jednog odobrenog roditelja; gdje i kako se to čuva.
---

# Jedan roditelj po učeniku

Model licenci: 1 učenik = 1 roditelj. Invarijanta: za svakog `ucenik`-a postoji
NAJVIŠE jedan red u `roditelj_ucenik` sa `status='approved'`.

**Why:** Roditeljske licence ne ulaze u kvotu samo ako je odnos 1:1; više
odobrenih roditelja po učeniku ruši taj model. (Smjer roditelj→više djece, do 4,
je posebna stvar i OSTAJE dozvoljen.)

**How to apply:** Svaka tačka koja veže roditelja za POSTOJEĆEG učenika mora
provjeriti ima li učenik već drugog odobrenog roditelja i vratiti 409:
- muallim.ts: `POST /ucenici/:id/roditelj` (kreira novog), `POST /ucenici/:id/povezi-roditelja`
  (poveže postojećeg — provjeri DRUGOG, jer isti daje precizniju "već povezan"),
  `POST /approve-roditelj` (samo kad approved=true; odbijanje uvijek prolazi).
- roditelj.ts: `POST /link-dijete` (samoprijava roditelja — blokiraj DRUGOG odmah).
- NE dirati: create-student-with-parent (single+bulk) i roditelj `dodaj-dijete`
  — oni prave NOVOG učenika s jednim roditeljem.

DB backstop: parcijalni unique indeks `roditelj_ucenik_one_approved_per_ucenik_idx`
ON `roditelj_ucenik (ucenik_id) WHERE status='approved'` u runResidualSchema
(index.ts). OBAVEZNO prvo prebroji duplikate (učenici s 2+ approved) i preskoči
CREATE ako ih ima — inače CREATE INDEX sruši startup. Zatečeni duplikati se NE
brišu automatski (mogu biti stvarne porodice); ograničenje vrijedi unaprijed.

Poznata rupa (follow-up): kad indeks postoji, race koji ga prekrši izaђe kao
generic 500 (ili u `/ucenici/:id/roditelj` se pogrešno tretira kao username
collision retry) umjesto čistog 409. Invarijanta i dalje drži (tx rollback), samo
je poruka ružna.
