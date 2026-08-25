---
name: GitHub content API i JSX
description: Sigurno objavljivanje JSX promjena direktno preko GitHub Content API-ja.
---

Kod složenog JSX-a ne primjenjuj široke tekstualne zamjene na udaljenom fajlu bez poređenja rezultata s verificiranom lokalnom verzijom.

**Why:** Marker-zamjena može pogoditi zatvaranje ternarnog izraza umjesto layout wrappera i ostaviti ili ukloniti `)}`, što lokalni build druge verzije ne otkriva.

**How to apply:** Nakon API izmjene učitaj baš objavljeni fajl, provjeri problematični blok, i tek potom pokreni ili zatraži Coolify redeploy. Kad je moguće, objavi cijeli lokalno buildan fajl ako se njegov GitHub bazni SHA podudara.