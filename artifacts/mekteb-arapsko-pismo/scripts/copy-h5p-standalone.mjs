// Kopira h5p-standalone/dist (frame.bundle.js, main.bundle.js, styles/, fonts/,
// images/) u public/h5p-standalone/ tako da se u produkcijskom buildu serviraju
// kao statički fajlovi sa očuvanom relativnom strukturom. Bez ovoga, h5p.css
// referencira ../fonts i ../images koji u Vite buildu ne postoje, a frameJs put
// se gubi jer Vite hešira ime main.bundle.js → frame.bundle.js vraća index.html
// ("Unexpected token '<'"). Pokreće se prije `dev` i `build` (vidi package.json).
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const mainBundle = require.resolve("h5p-standalone/dist/main.bundle.js");
const distDir = path.dirname(mainBundle);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(scriptDir, "..", "public", "h5p-standalone");

fs.rmSync(publicDir, { recursive: true, force: true });
fs.mkdirSync(publicDir, { recursive: true });
fs.cpSync(distDir, publicDir, { recursive: true });

console.log(`[copy-h5p-standalone] ${distDir} -> ${publicDir}`);
