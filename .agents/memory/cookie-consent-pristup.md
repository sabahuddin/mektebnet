---
name: Cookie consent pristup
description: Zašto Mekteb koristi informativni cookie banner umjesto granularnog pristanka
---

Mekteb prikazuje informativni cookie banner s jednim "Prihvatam" dugmetom + link na `/kolacici` politiku, BEZ granularnih accept/reject toggle-a. Pojavljuje se ~1.2s nakon prvog posjeta, renderovan globalno u App.tsx (z-[70], iznad install/push prompta).

**Why:** Platforma koristi samo neophodne (token prijave — consent-exempt) i funkcionalne kolačiće/localStorage (mekteb-lang, mekteb-fontsize, mekteb-audio). Nema analitike, oglašavanja ni third-party praćenja; OneSignal push je već zaseban opt-in. Granularni reject toggle bi bio "theater" — nema šta opcionalno odbiti, a funkcionalne postavke se postavljaju bez obzira na banner. Ovo je obavijest (notice), ne pravi pristanak — dovoljno za ovaj profil kolačića.

**How to apply:** Ako se ubuduće doda analitika/oglašavanje/third-party tracking, banner MORA preći na pravi granularni pristanak (prior opt-in) prije postavljanja tih kolačića. Pristanak se pamti versionirano (`mekteb-cookie-consent="v1"`); bump verzije ponovo prikazuje banner nakon izmjene politike. Link na politiku NE smije bilježiti pristanak (samo dugme/X).
