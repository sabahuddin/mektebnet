---
name: Plain-content lekcije i akordion editor
description: Zašto DODATAK/medaljon lekcije nemaju akordion kontrole u editoru i kako se dodaju.
---

WysiwygEditor (`components/wysiwyg-editor.tsx`) renderuje traku sekcija i SVE
kontrole akordiona samo kad `parsed.hasAccordions === true` (tj. kad sadržaj ima
bar jedan `.lesson-accordion`). DODATAK lekcije (slug `dodatak-nivo%`) i medaljon
prazne lekcije kreiraju se sa čistim `<p>` sadržajem → `hasAccordions=false` → nema
"Nova" dugmeta → admin ne može dodati akordion.

**Rješenje:** `convertToAccordions()` + dugme "Dodaj akordion sekciju" koje se
prikazuje kad `!parsed.hasAccordions` — trenutni sadržaj postaje prva sekcija.

**Why:** accordion-mode save path (`__wysiwygGetFullHtml`) ponovo ubacuje hero u
`beforeAccordions`; ako sadržaj sekcije sadrži hero, hero se duplira. Zato pri
konverziji hero treba ukloniti iz sadržaja sekcije (čuva se u `heroImage` state-u).

**Napomena:** HTML-mode save koristi stale `html` state (markDirty ne ažurira ga);
to je pre-postojeće ograničenje za SVE vizuelne izmjene, ne samo konverziju.
