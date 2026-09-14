---
name: Bundler template script escape
description: Sigurno prepakivanje samostalnih HTML vježbi čiji je dokument spremljen kao JSON unutar script taga.
---

Kad se `__bundler/template` JSON parsira, mijenja i ponovo serijalizira, svaki unutrašnji zatvarajući `script` tag mora u ugrađenom JSON tekstu ostati zapisan kao `<\u002Fscript>`, a ne kao doslovni HTML tag.

**Why:** `JSON.stringify` vraća doslovni zatvarajući tag. HTML parser ga tada protumači kao kraj vanjskog bundler taga, skrati JSON i browser prijavi `Unterminated string in JSON`, iako Node može parsirati fajl čitajući do posljednjeg taga.

**How to apply:** Nakon serijalizacije template objekta zamijeni doslovne zatvarajuće `script` tagove sigurnim Unicode escape oblikom. Provjeri rezultat kroz stvarni browser, ne samo `JSON.parse` nad sadržajem fajla.