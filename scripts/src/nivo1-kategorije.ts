/**
 * Dodjela kategorije i tagova pitanjima Nivoa 1 na osnovu ključnih riječi.
 *
 * Kategorije i tagovi su iz `KVIZ_KATEGORIJE` / `KVIZ_TAGOVI` u shemi.
 * Pravila se provjeravaju redom — prvo poklapanje pobjeđuje — pa specifičnija
 * pravila (imena sura, biografija Poslanika) stoje prije općenitijih.
 * Uzorci namjerno nemaju granicu riječi na kraju, da bi hvatali i padeže
 * ("abdest" → "abdesta", "desn" → "desnom"). Na početku se koristi unicode
 * lookbehind umjesto `\b`, jer je `\b` u JS-u ASCII-baziran pa ne bi hvatao
 * riječi koje počinju sa č, ć, š, ž ili đ ("čistoća", "džamija", "šehadet").
 *
 * Ovo je pomoć uredniku, a ne konačna klasifikacija — sve se može promijeniti
 * u banci pitanja.
 */

type Pravilo = { kategorija: string; tagovi: string[]; uzorak: RegExp };

const PRAVILA: Pravilo[] = [
  // ── Kiraet ────────────────────────────────────────────────────────────────
  {
    kategorija: "kiraet", tagovi: ["sure"],
    uzorak: /(?<![\p{L}\p{N}])(?:el-?fatiha|fatih|el-?ihlas|ihlas|en-?nas\b|el-?felek|felek|el-?leheb|leheb|en-?nasr|nasr\b|mu'?avv|zaštitnic|ajetul-?kursi|et-?tin|el-?bekare|majka kur'?ana|posljednja sura|prva sura)/iu,
  },
  {
    kategorija: "kiraet", tagovi: ["kuran_tekst"],
    uzorak: /(?<![\p{L}\p{N}])(?:magdubi|dallin|jevmid|na'?budu|nesta'?in|samed|kufuven|juled|lem jelid|gasikin|neffasat|hasidin|vesvas|hannas|džinneti|sudurin|mesed|tebbet|hammaletel|nasrul|efvada|kul e'?udu|kul huvallahu|iza džae|rabbil-?alamin|er-?rahmanir|ajet)/iu,
  },
  // ── Historija islama ──────────────────────────────────────────────────────
  {
    kategorija: "historija", tagovi: ["zivot_poslanika"],
    uzorak: /(?<![\p{L}\p{N}])(?:hidžr|622|571|mevlud|miradž|rebiul-?evvel|rebiul-?ahir|muharrem|safer|ševval|zul-?hidž|zul-?kade|redžeb|ša'?ban|džumadel|hidžretsk|abdullah|amin[au]\b|kurejš|hašim|hira|ikra|preselj|preseljen|osvojenje mekke)/iu,
  },
  {
    kategorija: "historija", tagovi: ["zivot_poslanika"],
    uzorak: /(?:muhammed[^?.]{0,60}(?:rođ|otac|majk|mekk|medin|poslanstv|objav|godin|život)|rođen[^?.]{0,40}muhammed|grad u arabiji)/iu,
  },
  // ── Ibadet ────────────────────────────────────────────────────────────────
  {
    kategorija: "ibadet", tagovi: ["abdest"],
    uzorak: /(?<![\p{L}\p{N}])(?:abdest|abdesk|gusul|gusulsk|tejemum|tejemumsk|mesh\b|gargar|istinšak|džunub|čistoć|vudžud|vod[aeiou]|zemzem|oprati|umiti|potira|potiran)/iu,
  },
  {
    kategorija: "ibadet", tagovi: ["namaz"],
    uzorak: /(?<![\p{L}\p{N}])(?:namaz|namask|rekat|rukn|ruknov|kijam|ruku'|sedžd|kadei|iftitahi|kiraet|ezan|ikamet|mujezin|kibl|kab[aeiou]\b|hadžerul|nijet|sabah|podne|ikindij|akšam|jacij|subhane rabbij|semiallahu|klanja|džamij|mihrab|munar|sunnet|farz|odjeć|odijev)/iu,
  },
  {
    kategorija: "ibadet", tagovi: ["dove"],
    uzorak: /(?<![\p{L}\p{N}])(?:dova|dove|dovu|dovom|subhanek|et-?tehij|tehijjat|salavat|rabbi jessir|rabbi zidni|rabbi temmim|rabbi\b|allahu rabbi|hasbi rabbi|rabbena atina|vekina|tebarekesmuk|tebareke ismuk|te'?ala džedduk|la ilahe gajruk|kelime-?i šehadet|šehadet|bismill|bismilla|euzubill|e'?uzu)/iu,
  },
  {
    kategorija: "ibadet", tagovi: ["zikrovi"],
    uzorak: /(?<![\p{L}\p{N}])(?:zikr|tesbih|tespih|subhanallah|elhamdulillah|allahu ekber|tekbir)/iu,
  },
  {
    kategorija: "ibadet", tagovi: ["post"],
    uzorak: /(?<![\p{L}\p{N}])(?:post\b|posti|postu|ramazan)/iu,
  },
  {
    kategorija: "ibadet", tagovi: ["ostali_ibadeti"],
    uzorak: /(?<![\p{L}\p{N}])(?:bajram|kurban|mubarek|dinsk\w* šart|islamsk\w* šart|stub\w* islama|zekat|hadž|tešrik)/iu,
  },
  // ── Akaid (specifično) ────────────────────────────────────────────────────
  {
    kategorija: "akaid", tagovi: ["meleki"],
    uzorak: /(?<![\p{L}\p{N}])(?:melek|meleci|džebrail|džibril|mikail|israfil|azrail|munker|munkir|nekir|ridvan|kiramen|katibin)/iu,
  },
  {
    kategorija: "akaid", tagovi: ["knjige"],
    uzorak: /(?<![\p{L}\p{N}])(?:tevrat|zebur|indžil|božansk\w* knjig|allahov\w* knjig|objava|posljednja objava)/iu,
  },
  {
    kategorija: "akaid", tagovi: ["poslanici"],
    uzorak: /(?<![\p{L}\p{N}])(?:poslanik|poslanic|adem|nuh\b|ibrahim|musa\b|isa a\.?s|124\.?000|alejhis-?selam|sallallahu|radijallahu)/iu,
  },
  // ── Ostali sadržaji (mekteb i školski život) ──────────────────────────────
  {
    kategorija: "bosna", tagovi: ["ostalo"],
    uzorak: /(?<![\p{L}\p{N}])(?:mekteb|muallim|mirza|ilmihal|pouk|sport|rekreacij|utakmic|plivanj|jahanj|streljaštv|ilahij|akademij|transparent|rešad kadić|nevres|pjesmic|džemat|bošnjac|bosn)/iu,
  },
  // ── Akaid (općenito) ──────────────────────────────────────────────────────
  {
    kategorija: "akaid", tagovi: ["allah"],
    uzorak: /(?<![\p{L}\p{N}])(?:imansk|iman\b|ihsan|kader|sudnji dan|ahiret|dženn|kabur|dželle šanuhu|subhanehu|stvorio|stvorenj|stvaramo|stvoritelj|namjesnik|neuron|mozg|džin|allah\b|allaha|allahu|allahov)/iu,
  },
  {
    kategorija: "akaid", tagovi: ["kuran"],
    uzorak: /(?<![\p{L}\p{N}])(?:kur'?an|sura|sure\b|suri\b)/iu,
  },
  {
    kategorija: "akaid", tagovi: ["allah"],
    uzorak: /(?<![\p{L}\p{N}])(?:islam|musliman|vjersk|vjer[aeou]|vjerovanj|vjeruj)/iu,
  },
  // ── Ahlak ─────────────────────────────────────────────────────────────────
  {
    kategorija: "ahlak", tagovi: ["ponasanje"],
    uzorak: /(?<![\p{L}\p{N}])(?:selam|es-?selamu|mašallah|inšallah|estagfirullah|el-?hamdu|elhamdu|jerhamukellah|desn|lijev|pozdrav|ponašanj|kihn|poštuj|laž|istin|iskren|oprost|kaje)/iu,
  },
];

const PODRAZUMIJEVANO = { kategorija: "bosna", tagovi: ["ostalo"] };

/** Vraća kategoriju i tagove za pitanje, na osnovu njegovog teksta i sadržaja. */
export function odrediKategoriju(p: {
  pitanje: string;
  opcije?: string[];
  objasnjenje?: string;
  meta?: { text?: string; template?: string[]; words?: string[] } | null;
}): { kategorija: string; tagovi: string[] } {
  // Dio pitanja koristi transkripciju sa dugim vokalima (Mašallāh, E'ūzu),
  // pa ih svodimo na obične vokale prije poređenja.
  const bezDuzina = (t: string) => t.replace(/[āĀ]/g, "a").replace(/[īĪ]/g, "i").replace(/[ūŪ]/g, "u").replace(/[ēĒ]/g, "e").replace(/[ōŌ]/g, "o");
  const tekst = bezDuzina([
    p.pitanje,
    ...(p.opcije ?? []),
    p.objasnjenje ?? "",
    p.meta?.text ?? "",
    ...(p.meta?.template ?? []),
    ...(p.meta?.words ?? []),
  ].join(" "));
  for (const pravilo of PRAVILA) {
    if (pravilo.uzorak.test(tekst)) return { kategorija: pravilo.kategorija, tagovi: pravilo.tagovi };
  }
  return PODRAZUMIJEVANO;
}
