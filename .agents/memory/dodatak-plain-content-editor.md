---
name: Plain-content lekcije i akordion editor
description: Zašto neke lekcije nemaju akordion kontrole u editoru i kako se dodaju.
---

WysiwygEditor prikazuje traku sekcija i sve akordion kontrole SAMO kad sadržaj
već ima bar jedan akordion. Lekcije kreirane s čistim `<p>` sadržajem (DODATAK,
prazne medaljon lekcije) zato nemaju nikakvo dugme za dodavanje akordiona.

**Rješenje:** afordansa "Dodaj akordion sekciju" koja se prikaže kad sadržaj
nema akordiona i pretvori trenutni sadržaj u prvu sekciju.

**Why:** accordion-mode save ponovo ubacuje hero u dio prije sekcija; ako sadržaj
sekcije sadrži hero, hero se duplira pri spremanju. Pri konverziji hero treba
izdvojiti iz sadržaja sekcije.

**Zasebno ograničenje:** HTML-mode save koristi stale `html` state, pa prelazak
vizuelno→HTML→Spasi može izgubiti vizuelne izmjene. Pre-postojeće, važi za sve
vizuelne izmjene.
