---
name: Tailwind v4 modal centriranje
description: Stabilno centriranje fiksnih modala koji nasljeđuju Tailwind translate utility klase.
---

Za posebne fiksne modale koji moraju biti bez animacijskih transformacija, centriraj ih sa `inset: 0` i automatskim marginama te resetuj obje Tailwind translate varijable.

**Why:** Produkcijski CSS optimizator može ukloniti deklaraciju `translate: none`, dok Tailwind utility klase i dalje koriste interne translate varijable i pomjere modal u ugao.

**How to apply:** Kada element već ima Tailwind `translate-x/y` klase, provjeri kompajlirani CSS. Resetuj interne x/y varijable na nulu umjesto oslanjanja samo na `translate: none`.