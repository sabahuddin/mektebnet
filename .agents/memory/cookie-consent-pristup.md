---
name: Cookie consent pristup
description: Zašto Mekteb koristi informativni cookie banner umjesto granularnog pristanka
---

Mekteb prikazuje informativni cookie banner s dugmetom "U redu" + link na `/kolacici` politiku, BEZ granularnih accept/reject toggle-a. To je potvrda čitanja obavijesti, ne pravni pristanak na praćenje.

**Why:** Platforma koristi lokalnu pohranu za prijavu i postavke te neophodni HttpOnly kolačić za pristup H5P sadržaju. Nema analitike ni oglašavanja; OneSignal push je zaseban opt-in. Granularni reject toggle ne bi imao šta opcionalno odbiti.

**How to apply:** Ako se ubuduće doda analitika/oglašavanje/third-party tracking, banner MORA preći na pravi granularni pristanak (prior opt-in) prije postavljanja tih kolačića. Pregled obavijesti se pamti versionirano; promjena verzije ponovo prikazuje banner. Link na politiku NE smije bilježiti pregled (samo dugme/X).
