---
name: Reorder UI mora podržavati touch
description: Zašto liste s premještanjem na ovom projektu koriste Pointer Events, ne HTML5 draggable.
---

Liste gdje korisnik premješta stavke (npr. reorder kviz pitanja, raspored lekcija) moraju raditi i prstom na touchscreenu.

**Why:** Publika su djeca na tabletima/telefonima. HTML5 `draggable` + dragstart/drop NE radi na dodir — samo miš. Korisnik je eksplicitno tražio prevlačenje prstom u kvizu.

**How to apply:** Koristi Pointer Events (`onPointerDown/Move/Up` + `setPointerCapture`) i `document.elementFromPoint` za ciljni red (preko `data-*` atributa indeksa), uz `touch-none` na grip handle da stranica ne skrola. Zadrži strelice gore/dolje kao pristupačan fallback. Raspored editor (muallim) i dalje koristi HTML5 draggable jer je desktop-orijentisan; ako zatreba touch i tamo, prebaci na isti Pointer Events obrazac.
