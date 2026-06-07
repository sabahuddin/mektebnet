---
name: Glavni muallim invarijanta
description: Pravilo "tačno jedan glavni muallim po džematu" i kako se održava kroz dvije tabele
---

# Glavni muallim — jedan po džematu

Svaki mekteb (džemat) smije imati najviše jednog glavnog muallima.

**Stanje se drži na dva mjesta koja moraju ostati usklađena:**
- `muallim_profili.is_glavni` (boolean po muallimu)
- `mektebi.glavni_muallim_id` (pointer na usera)

**Why:** glavni muallim ima admin privilegije unutar džemata (dodaje
kolege, vidi zbirnu statistiku). Više "glavnih" odjednom je
nekonzistentno i zbunjuje UI.

**How to apply:** kad postavljaš nekog za glavnog, u jednoj transakciji
prvo skini `is_glavni=false` svima u tom mektebu, pa postavi cilj na
true i upiši `mektebi.glavni_muallim_id`. Kad muallima premještaš iz
džemata ili mu skidaš status, očisti `glavni_muallim_id` ako je
pokazivao na njega. Promocija zahtijeva da muallim već ima `mektebId`.
