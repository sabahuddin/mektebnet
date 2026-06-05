---
name: H5P runtime asseti u Vite buildu
description: Zašto h5p-standalone (frame.bundle.js / h5p.css / fonts) mora ići iz public/, ne preko ?url importa
---

# H5P runtime asseti i Vite hash

h5p-standalone runtime (`main.bundle.js`, `frame.bundle.js`, `styles/h5p.css`,
`fonts/`, `images/`) servira se iz `public/h5p-standalone/`, referencirano preko
`import.meta.env.BASE_URL`. Kopira ga `scripts/copy-h5p-standalone.mjs` (gitignored)
prije `dev`, `build` i `build:mobile`.

**Why:** Ranija verzija je radila `import url from "h5p-standalone/dist/main.bundle.js?url"`
pa regexom skidala `/main.bundle.js` da dobije bazu za frameJs/frameCss. U
produkcijskom buildu Vite hešira ime u `main.bundle-<hash>.js`, regex ne pogodi,
i `frameJs` postane neispravan put → server vrati `index.html` (SPA fallback) →
`frame.bundle.js: Uncaught SyntaxError: Unexpected token '<'`. Dodatno: `frame.bundle.js`
i `h5p.css` su referencirani string-om (ne importani) pa ih Vite uopće ne emituje,
a `h5p.css` referencira `../fonts` i `../images` koji moraju zadržati relativnu strukturu.
Bug je bio PRODUKCIJSKI-ONLY (dev ne hešira), zato je "radilo u Lumi/dev a ne na mekteb.net".

**How to apply:** Za bilo koji vendor runtime koji interno referencira svoje asete
relativnim putevima (CSS url(), iframe bundle), nemoj se oslanjati na Vite `?url` +
string manipulaciju. Kopiraj cijeli dist u `public/` i referenciraj preko `BASE_URL`.
Provjera ispravnosti: `frame.bundle.js` mora vraćati `content-type: text/javascript`,
a ne HTML.
