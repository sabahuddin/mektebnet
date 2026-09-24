/**
 * Napravi sadržaj vježbe „Nauči napamet" iz odobrene tabele transkripcije.
 *
 * Arapski tekst NIJE ovdje: vježba ga uzima sa istog izvora kao Kur'an modul
 * (api.alquran.cloud), pa se mushafski zapis nigdje ne prepisuje rukom.
 *
 * Pokretanje: pnpm --filter @workspace/scripts exec tsx src/napravi-napamet-podatke.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CJELINE } from "./transkripcija-podaci.js";
import { njemackiIzEngleskog } from "./transkripcija.js";

const IZLAZ = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../artifacts/mekteb-arapsko-pismo/public/vjezbe/napamet/podaci",
);

/** Ajeti sure, redom, kao bosanski ključevi iz tabele transkripcije. */
interface Sura {
  id: string;
  sura: number;
  naslov: { bs: string; de: string; en: string };
  /** Bosanski zapis svakog ajeta — mora postojati u tabeli transkripcije. */
  ajeti: string[];
}

const SURE: Sura[] = [
  {
    id: "el-fatiha",
    sura: 1,
    naslov: {
      bs: "Nauči El-Fatihu napamet",
      de: "Lerne Al-Fatiha auswendig",
      en: "Learn Al-Fatihah by heart",
    },
    ajeti: [
      "Bismillahir-rahmanir-rahim",
      "Elhamdu lillahi rabbil-alemin",
      "Er-rahmanir-rahim",
      "Maliki jevmid-din",
      "Ijjake na'budu ve ijjake neste'in",
      "Ihdines-siratal-mustekim",
      "Siratallezine en'amte alejhim gajril-magdubi alejhim ve led-dallin",
    ],
  },
];

const UPUTA = {
  bs: "Slušaj ajet, pa ga prouči sam. Kad ti ide bez greške, dodaj sljedeći.",
  de: "Hör dir den Vers an und sprich ihn dann selbst. Wenn er fehlerfrei geht, nimm den nächsten dazu.",
  en: "Listen to the verse, then recite it yourself. When it goes without a mistake, add the next one.",
};

const PO_BOSANSKOM = new Map(
  CJELINE.flatMap((c) => c.redovi).map((r) => [r.bs, r.en]),
);

for (const s of SURE) {
  const en = s.ajeti.map((bs) => {
    const zapis = PO_BOSANSKOM.get(bs);
    if (!zapis) throw new Error(`Nema u tabeli transkripcije: „${bs}"`);
    return zapis;
  });
  const podaci = {
    id: s.id,
    sura: s.sura,
    naslov: s.naslov.bs,
    uputa: UPUTA.bs,
    ucac: "husary_muallim",
    transkripcija: s.ajeti,
    prijevodi: {
      de: { naslov: s.naslov.de, uputa: UPUTA.de, transkripcija: en.map(njemackiIzEngleskog) },
      en: { naslov: s.naslov.en, uputa: UPUTA.en, transkripcija: en },
    },
  };
  const put = path.join(IZLAZ, `${s.id}.json`);
  fs.writeFileSync(put, `${JSON.stringify(podaci, null, 2)}\n`, "utf8");
  console.log(`${put}  (${s.ajeti.length} ajeta)`);
}
