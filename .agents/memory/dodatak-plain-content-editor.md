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

Muallimov HTML prolazi kroz sanitizer koji uklanja `onclick`. Ranije je
uklanjao i cijeli `<button>` element akordiona, ali su `lesson-accordion`,
`lesson-content` i njihov tekst ostajali u bazi. Takve sekcije nisu bile
izbrisane, nego ih je čitač preskakao jer je zahtijevao `onclick`.

**Why:** HTML događaji ne smiju preživjeti sanitizer, ali prikaz i ponovno
uređivanje već sačuvanog sadržaja ne smiju zavisiti od tih događaja.

**How to apply:** Identitet sekcije čitaj prvenstveno iz ID-a njenog sadržaja.
Toleriraj stare sačuvane sekcije bez dugmeta (naslov je direktan tekst
akordiona). Pri novom snimanju čuvaj neizvršivu strukturu dugmeta i sadržaja.
