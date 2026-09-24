---
name: Backup vanjske produkcijske baze
description: Klijent pg_dump u Replit okruženju može biti stariji od samostalne produkcijske PostgreSQL baze.
---

Prije promjene sadržaja na produkciji provjeri je li `pg_dump` kompatibilan s verzijom vanjskog PostgreSQL servera; ako nije, napravi provjerljiv izvoz kompletne ciljane tabele kao JSONL pomoću `psql` i `row_to_json`.

**Why:** U septembru 2026. dostupni `pg_dump` bio je verzije 16, a produkcijski server verzije 17; `pg_dump` je odbio izvoz zbog neusklađenosti verzija. Izvoz preko `psql` je uspio, uz provjeru broja redova i očuvanosti sadržaja.

**How to apply:** Prije upisa sačuvaj ciljanu tabelu u privatni `.local/state/prod-backup/` pomoću `SELECT row_to_json(t) FROM ime_tabele t ORDER BY id`, provjeri da datoteka nije prazna i da broj redova odgovara očekivanom. Ne prikazuj konekcijski string ni sadržaj korisničkih podataka.