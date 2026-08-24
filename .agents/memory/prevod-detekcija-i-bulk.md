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

## Iznimka: kratka pitanja i kanonski termini

Za **kratke kviz-stringove** ne tretiraj samo prisustvo `ž/đ/ć` ili jednakost izvora i prijevoda
kao grešku. Njemački smije imati stručni termin u zagradi (npr. `Bedingung (šart)`), a nazivi
sura/dova, arapske transliteracije i ustaljeni nazivi namaza (npr. Fatiha, Kunut-dova,
Subhaneke, Sabah namaz) smiju ostati isti.

**Why:** Opći marker-prag vraća već valjane kratke prijevode u beskonačnu bulk obradu.

**How to apply:** Za kratke tekstove popravljaj potpuno nepromijenjenu **bosansku prozu**, ali
izuzmi arapsko pismo i eksplicitnu listu kanonskih naziva. Ponovni pokušaj za stvarno
nepreveden stručni termin mora tražiti ciljni izraz uz bosanski termin u zagradi. Koristi
read-only listu poslova prije `--force`, da se ne prevode ponovo već ispravni redovi.

## HTML QA: imena i URL-ovi nisu bosanska proza

Kod dugog HTML-a grubi odnos bošnjačkih markera (`č/ć/đ/ž`) ne smije sam odbiti prijevod koji
ima dovoljno njemačke proze: vlastita imena, mjesta i porodična imena legitimno zadržavaju te
znakove. URL-ovi su također nepromjenjivi sadržaj, ne rečenice za prijevod.

**Why:** Ispravni njemački prijevodi lekcija s mnogo bošnjačkih imena bili su pogrešno blokirani,
a jedan nepromijenjeni YouTube URL bio je prijavljen kao bosanski tekst.

**How to apply:** Zadrži grubu marker-provjeru kao fallback za tekst bez jasnih signala ciljnog
jezika, ali glavni dokaz neka bude nepromijenjeni vidljivi tekstualni čvor. Preskoči čvor koji je
samo `http(s)` ili `www` URL.

# Bulk AI prijevod velikog HTML-a protiv PROD baze

- **PROD_DATABASE_URL može biti dostupan iz Replit dev** za direktan read/write na self-hosted prod,
  ali nije garantovan: kada TCP/5432 vrati `ECONNREFUSED`, ne pokušavati upise niti zaključivati iz
  zastarjele dev baze. Za read-only reviziju koristi live `mekteb.net/api/content/ilmihal` sa
  `X-Lang` zaglavljem; servisani odgovor je tada stvarni korisnički sadržaj. Sandbox
  (`code_execution`) STRIPA `process.env` secrete → DB+AI skripte, kad je DB dostupan, vozi kao
  **node skriptu preko bash** (tamo `process.env` ima secrete), ne u sandboxu.
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
→ ispravka reda u prod bazi je ODMAH live na mekteb.net, bez redeploya (podaci ≠ kod). Lokalni
overlay brojevi mogu biti potpuno drugačiji od live API-ja, pa produkcijski audit mora biti zaseban.

# Batch prijevod KRATKIH stringova (kviz/text) — mapiraj po INDEKSU, ne po echo-ključu

**Pravilo:** Za batch prijevod niza stringova traži od modela `{"prijevodi":[...]}` niz ISTE DUŽINE
i ISTOG REDOSLIJEDA pa zip-uj s NAŠIM originalima po indeksu. NE oslanjaj se na `dict[original]`
(model echo-uje ključ pa ga "popravi").
**Why:** Izvorni mekteb sadržaj sadrži pomiješana pisma — latinica + ćirilica **homoglifi** (npr.
"Džemal**удином**", "Kur**ана** **о** životu") i pravopisne greške. Pri echo-key mapiranju model
normalizuje/ispravi ključ → `dict[original]` promaši → cijeli posao se TIHO preskoči (4 reda bila
0/5 jezika dok nije otkriveno). Bilo kakvo egzaktno string-matchanje protiv izvora puca na ovome.
**How to apply:** system I user prompt MORAJU tražiti ISTI oblik odgovora; kontradikcija (system traži
map `ključ=original`, user traži niz) → model nekad vrati drugi oblik i tihi fallback puca — uskladi oba.
Drži length-guard (arr.length === items.length) da odbaciš misalignment umjesto da upišeš pogrešno;
za izolaciju problematičnog reda spusti `--chunk` (1–4). Invarijanta kviza: prevedeni `answer` mora
ostati ∈ prevedenim `options` (FE poredi tekstualno, opcije izmiješane) — postiže se prevođenjem
SVIH stringova (pitanje+opcije+odgovor) kroz isti dict.

**kviz_pitanja je MIJEŠAN tip u produ:** dio redova je jsonb `array`, dio je dvostruko-enkodiran JSON
`string` (jsonb scalar). Raw SQL (`db.execute`) NE prolazi kroz drizzle auto-JSON.parse (serving put
to radi automatski) → string-redove ručno `JSON.parse` pa `Array.isArray` provjeri. Postoji i 1 outlier
red s bosanskim ključevima `pitanje/odgovori/tacanOdgovor` koji FE (`QuizQuestion`=question/options/answer)
ne renderuje pa je prijevod bespredmetan.
