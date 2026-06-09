---
name: content_prijevodi overlay pokrivenost
description: Svaka content-servirajuća ruta (i list i detail) mora primijeniti overlay, inače taj ekran tiho ostaje bosanski.
---

Prijevodi se serviraju overlay helperom (`content-translatable.ts`: `overlayRows`/`overlayOne` + `getLang` po X-Lang headeru), fallback na bosanski kad prijevod ne postoji/prazan je.

**Pravilo:** kad dodaješ overlay na neki modul, moraš ga ukačiti na SVE rute koje vraćaju taj sadržaj — i listing (`/knjige`) i detalj (`/knjige/:slug`). Lako je prevesti listu a zaboraviti detalj; tada se naslov u listi prevodi ali cijela stranica sadržaja (content_html) ostaje bosanska.

**Why:** upravo se to desilo — `/api/content/knjige/:slug` je vraćao `knjiga` bez `overlayOne`, pa je detalj knjige ostajao bosanski iako su prijevodi postojali u bazi. Code review ga je uhvatio.

**How to apply:** pri auditu lokalizacije prođi kroz content.ts (i mapa/misije/games rute) i potvrdi da svaka ruta koja vraća polja iz `CT_TABLES` ima `overlayRows`/`overlayOne(... getLang(req))` prije `res.json`. Smoke test i detalj rute s `X-Lang`, ne samo listu.

**Prihvaćeni gap:** interaktivna kviz meta (kvizovi.pitanja JSONB / dragDrop/markWords) ostaje bosanska — pitanja bez matcha u banci nemaju prevodni sloj. Prihvaćeno po planu.
