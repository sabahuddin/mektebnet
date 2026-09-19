---
name: Pregledana zadaća i nagrada
description: Veza između pregleda zadaće, ocjene, kapi meda i završenog statusa.
---

Dodjela ocjene ili pozitivnog broja kapi meda znači da je muallim pregledao zadaću, pa status mora postati završen i `uradjeno` mora biti tačno. Izričito vraćanje na čekanje ima prednost i ne smije ga kasniji kompatibilnosni backfill poništiti.

**Why:** Stariji tok je mogao dodijeliti kapi meda bez promjene statusa, pa je nagrađena zadaća ostajala u „U toku“ i nakon isteka roka.

**How to apply:** Svaki novi ili alternativni tok za ocjenjivanje/nagrađivanje zadaće mora održavati ovu invarijantu. Backfill starih redova ograničiti na nepregledane zapise, kako se svjesno ponovno otvaranje ne bi automatski zatvorilo.