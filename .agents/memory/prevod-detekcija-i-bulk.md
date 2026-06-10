---
name: Prijevod — detekcija "nepreveden" + bulk AI prijevod
description: Kako pouzdano detektovati neprevedene content_prijevodi redove i bulk-prevesti veliki HTML protiv prod baze.
---

# Detekcija neprevedenih content_prijevodi redova

**NE koristi egzaktnu jednakost (`prijevod = izvor`) za detekciju neprevedenog.** Pokvareni
bulk poslovi ostave red koji se od izvora razlikuje za 1–5 znakova ali je SADRŽAJNO i dalje
bosanski (npr. `len_ratio` 1.00 a tijelo bosansko). Egzaktna jednakost drastično podcijeni obim.

**Koristi jezik-agnostičnu retenciju bosanskih ortografskih markera** (znakovi `žđćČĆĐŽ`):
`bos_count = char_length(s) - char_length(translate(s,'žđćČĆĐŽ',''))`. Red je JOŠ BOSANSKI ako
`bos_count(prijevod) > 0.30 * bos_count(izvor)`. Pravi prijevod padne na ~0 markera (par ostane
zbog honorifika `dž.š.` i imena). Razdvajanje je čisto: pravi ~0.00–0.07, bosanski ~1.00.
Dodatni signal: `len_ratio` pravog prijevoda — de/sq/tr ~1.05–1.15 duži, ar ~0.8 kraći; ~1.00 = sumnjivo.

# Bulk AI prijevod velikog HTML-a protiv PROD baze

- **PROD_DATABASE_URL secret JE dostupan iz Replit dev** za direktan read/write na self-hosted prod
  (psql i node `pg` rade). Sandbox (`code_execution`) STRIPA `process.env` secrete → DB+AI skripte
  vozi kao **node skriptu preko bash** (tamo `process.env` ima secrete), ne u sandboxu.
- AI: OpenAI integracija preko proxy-ja REST-om bez SDK-a: `POST ${AI_INTEGRATIONS_OPENAI_BASE_URL}/chat/completions`,
  header `Authorization: Bearer ${AI_INTEGRATIONS_OPENAI_API_KEY}`, model `gpt-5-mini`,
  **`reasoning_effort:"minimal"`** (bez toga 15KB HTML > 120s i timeout; sa minimal ~20–55s).
  `max_completion_tokens: 32000`. Provjeri `finish_reason==="length"` (odsječeno) i validuj rezultat
  (markeri ↓, dužina ratio 0.4–2.6, != izvor) PRIJE upisa da ne vratiš bug kopije.
- **Izvršavanje**: bash cap je 120s, a background poslovi se zamrznu → vozi **bounded foreground chunkove**
  s kapom redova po runu (npr. MAXROWS=5, CONC=5 ≈ jedan val 40–55s). Per-red UPDATE autocommit → resumable;
  ponavljaj dok selekcija ne vrati 0.
- `izvor_hash` u content_prijevodi = hex SHA256 UTF8 izvora (`crypto.createHash('sha256').update(src,'utf8')`).

**Why:** Ranija Čitaonica imala 38/60 content_html redova "prevedeno" a zapravo bosanski (kopija izvora
sa sitnim diffom); egzaktna detekcija ih je promašila. Overlay servira `prijevod` bez provjere izvor_hash
→ ispravka reda u prod bazi je ODMAH live na mekteb.net, bez redeploya (podaci ≠ kod).
