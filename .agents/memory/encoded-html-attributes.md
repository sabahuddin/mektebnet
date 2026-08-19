---
name: Encoded HTML atributi i apostrof
description: Zamka pri parsiranju encodeURIComponent JSON-a iz HTML data atributa
---

Kada je JSON spremljen kao `encodeURIComponent(JSON.stringify(...))` u HTML
`data-*` atributu, apostrof ostaje neescapovan. Parser mora poštovati stvarni
quote atributa: double-quoted vrijednost završava samo na `"`, a single-quoted
samo na `'`.

**Why:** Regex koji je za oba oblika prekidao na bilo kojem navodniku tiho je
odsijecao inače validne konfiguracije čim pitanje ili objašnjenje sadrži apostrof.

**How to apply:** Koristi HTML parser ili quote-aware ekstrakciju sa zasebnim
capture grupama; regresioni primjer obavezno treba sadržavati apostrof u encoded
JSON vrijednosti.