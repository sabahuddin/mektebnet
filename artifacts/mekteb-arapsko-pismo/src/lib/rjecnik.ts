export const RJECNIK: Record<string, string> = {
  "allah": "Bog, Gospodar svih svjetova, Stvoritelj svega postojećeg",
  "namaz": "Islamska molitva — jedan od pet stubova islama, obavlja se 5 puta dnevno",
  "tevhid": "Jednoboštvo — vjera u Jednog Allaha bez ikakvih sudruga",
  "abdest": "Ritualno čišćenje vodom koje prethodi namazu i učenju Kur'ana",
  "džemat": "Zajednica muslimana koji zajedno klanjaju ili žive",
  "ezan": "Islamski poziv na namaz koji mujezin uči s minareta",
  "kibla": "Smjer prema Kabi u Meki, kojim se musliman okreće za namaz",
  "džamija": "Islamska bogomolja i centar muslimanske zajednice",
  "farz": "Obavezna vjerska dužnost — čije je izvođenje obavezno za svakog muslimana",
  "sunnet": "Pohvalna radnja prema primjeru Poslanika Muhammeda, a.s.",
  "mekruh": "Pokuđena radnja — nije haram, ali se preporučuje izbjegavati",
  "haram": "Vjerski zabranjeno — strogo zabranjeno islamom",
  "halal": "Vjerski dozvoljeno — ono što islam dopušta",
  "dova": "Molitva — obraćanje Allahu riječima i srcem",
  "ibadet": "Bogoslužje — svaki čin koji se čini radi Allahovog zadovoljstva",
  "hadis": "Predaja o izreci, djelu ili odobravanju Muhammeda, a.s.",
  "ajet": "Redak Kur'ana — osnovna jedinica kur'anskog teksta",
  "sura": "Poglavlje Kur'ana — Kur'an ima 114 sura",
  "ramazan": "Deveti mjesec islamskog kalendara — mjesec posta i ibadeta",
  "post": "Ramazanski post — suzdržavanje od jela i pića od sabaha do akšama",
  "zekat": "Obavezni godišnji prilog za siromašne — 2,5% od ušteđevine",
  "sadaka": "Dobrovoljni prilog — svako dobro djelo računa se kao sadaka",
  "hadž": "Hodočašće u Meku — jedan od pet stubova islama",
  "taharet": "Obredna čistoća — osnova valjano obavljenog namaza",
  "gusul": "Kompletno ritualno kupanje cijeloga tijela",
  "zikr": "Spomen Allaha — ponavljanje Allahovih lijepih imena",
  "salavat": "Blagoslov na Poslanika Muhammeda, a.s.",
  "mujezin": "Osoba koja uči ezan s minareta džamije",
  "imam": "Predvodnik namaza i vjerski vođa zajednice",
  "muallim": "Vjeroučitelj — učitelj koji poučava o islamu",
  "mekteb": "Islamska vjeronaučna škola za djecu",
  "džennet": "Raj — obećano vječno boravište za pravovjerne",
  "džehennem": "Pakao — kazna za nevjernike i zle grješnike",
  "tespih": "Brojanica od 99+1 zrna — koristi se za zikr",
  "bismillah": "U ime Allaha, Milostivog, Samilosnog — izgovara se na početku svake radnje",
  "hamd": "Zahvala Allahu — Elhamdulillah (Hvala Allahu)",
  "tevbe": "Pokajanje — iskreno vraćanje Allahu nakon grijeha",
  "iman": "Vjera — iskreno vjerovanje u Allaha, meleke, knjige, poslanike, Sudnji dan i kader",
  "islam": "Potpuna predanost Allahu — vjera mira, milosti i predanosti",
  "kaba": "Sveto zdanje u Meki — najsvetije mjesto u islamu",
  "meka": "Najsvetiji grad islama u Saudijskoj Arabiji — rodno mjesto Muhammeda, a.s.",
  "medina": "Grad Poslanika, a.s. — drugo najsvetije mjesto u islamu",
  "poslanik": "Onaj koga Allah šalje kao Svog glasnika — Muhammed, a.s.",
  "melek": "Anđeo — Allah ih je stvorio od svjetlosti, ne griješe",
  "sabr": "Strpljenje — jedna od najvažnijih vrlina pravog vjernika",
  "nija": "Namjera — ibadet bez nijje nije ispravno primljen",
  "rakat": "Jedinica namaza — jedna kompletna sekvenca pokreta i učenja",
  "džuma": "Petak — poseban dan za muslimane sa zajedničkim namazom",
  "bajram": "Islamski praznik — Ramazanski (mali) i Kurbanski (veliki) bajram",
  "kurban": "Žrtva — klanje životinje za bajram u znak zahvalnosti Allahu",
  "hafiz": "Onaj koji je naučio kompletni Kur'an napamet",
  "šehadet": "Svjedočanstvo vjere: La ilahe illallah Muhammedur-resulullah",
  "hutba": "Propovijed — islamska propovijed na džumi ili bajramskom namazu",
  "takva": "Bogobojaznost — strah od Allaha i čuvanje od grijeha",
  "amanet": "Povjerena stvar — svaka dužnost koja nam je povjerena",
  "kader": "Allahova odredba — sve što se dešava je po Allahovoj volji",
  "tevekkul": "Oslanjanje na Allaha uz vlastiti trud i zalaganje",
};

export function processRjecnik(html: string): string {
  const sortedWords = Object.keys(RJECNIK).sort((a, b) => b.length - a.length);
  const wordPattern = sortedWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`\\b(${wordPattern})\\b`, "gi");

  return html.replace(/>([^<]+)</g, (match, text) => {
    const replaced = text.replace(regex, (word: string) => {
      const key = word.toLowerCase();
      const def = RJECNIK[key] || "";
      if (!def) return word;
      return `<span class="rjecnik-rijec" data-def="${def.replace(/"/g, "&quot;")}" tabindex="0">${word}</span>`;
    });
    return `>${replaced}<`;
  });
}
