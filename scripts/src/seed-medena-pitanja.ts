/**
 * Seed pitanja za Medenu stazu (8 kategorija × 20 pitanja = 160).
 *
 * Idempotent: koristi UPSERT po (kategorija, pitanje) — ako pitanje već postoji
 * sa istim tekstom u istoj kategoriji, ažurira opcije/correctIndex/objasnjenje.
 *
 * Pokreni:
 *   pnpm --filter @workspace/scripts run seed-medena-pitanja
 *
 * Ili kroz admin endpoint POST /api/admin/system/seed-medena-pitanja.
 */
import { db, igraPitanjaTable, MEDENA_KATEGORIJE, type MedenaKategorija } from "@workspace/db";
import { and, eq } from "drizzle-orm";

type SeedPitanje = {
  pitanje: string;
  opcije: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  objasnjenje: string;
  tezina?: 1 | 2 | 3;
};

// === ŠARTI (imanski + islamski + namaski) ========================================
const SARTI: SeedPitanje[] = [
  { pitanje: "Koliko ima imanskih šarta?", opcije: ["Pet", "Šest", "Sedam", "Osam"], correctIndex: 1, objasnjenje: "Imanskih šarta ima šest." },
  { pitanje: "Koliko ima islamskih šarta?", opcije: ["Tri", "Četiri", "Pet", "Šest"], correctIndex: 2, objasnjenje: "Islamskih šarta ima pet." },
  { pitanje: "Koji je prvi islamski šart?", opcije: ["Namaz", "Kelime-i šehadet", "Post", "Zekat"], correctIndex: 1, objasnjenje: "Prvi šart je vjerovanje i izgovaranje kelime-i šehadeta." },
  { pitanje: "Koji je peti islamski šart?", opcije: ["Hadž", "Zekat", "Post", "Namaz"], correctIndex: 0, objasnjenje: "Hadž (hodočašće u Mekku) je peti islamski šart, za onog ko može.", tezina: 2 },
  { pitanje: "Vjerovanje u meleke je koji imanski šart po redu?", opcije: ["Prvi", "Drugi", "Treći", "Četvrti"], correctIndex: 1, objasnjenje: "Vjerovanje u Allaha je prvi, a u meleke drugi imanski šart.", tezina: 2 },
  { pitanje: "Koji imanski šart govori o vjerovanju u Sudnji dan?", opcije: ["Treći", "Četvrti", "Peti", "Šesti"], correctIndex: 2, objasnjenje: "Vjerovanje u Sudnji dan je peti imanski šart.", tezina: 2 },
  { pitanje: "Vjerovanje u Allahove knjige je koji imanski šart?", opcije: ["Drugi", "Treći", "Četvrti", "Peti"], correctIndex: 1, objasnjenje: "Treći imanski šart je vjerovanje u Allahove objavljene knjige.", tezina: 2 },
  { pitanje: "Koliko ima šarta namaza koji se moraju ispuniti prije namaza?", opcije: ["Pet", "Šest", "Sedam", "Osam"], correctIndex: 1, objasnjenje: "Šarta namaza ima šest (čistoća tijela, odjeće, mjesta, pokrivenost stidnih dijelova, okrenutost prema Kabi i nastupanje vremena).", tezina: 3 },
  { pitanje: "Koliko ima ruknova (sastavnih dijelova) namaza?", opcije: ["Četiri", "Pet", "Šest", "Sedam"], correctIndex: 2, objasnjenje: "Ruknova namaza ima šest (kijam, kira'et, ruku', sedžda, kade, selam).", tezina: 3 },
  { pitanje: "Vjerovanje u sudbinu (kader) je koji imanski šart?", opcije: ["Četvrti", "Peti", "Šesti", "Nije imanski šart"], correctIndex: 2, objasnjenje: "Šesti imanski šart je vjerovanje u Allahovo određenje (kader).", tezina: 2 },
  { pitanje: "Šta znači riječ 'Iman'?", opcije: ["Klanjanje", "Vjerovanje", "Post", "Pomaganje"], correctIndex: 1, objasnjenje: "Iman znači vjerovanje srcem i potvrda jezikom." },
  { pitanje: "Šta znači riječ 'Islam'?", opcije: ["Pobjeda", "Predanost Allahu", "Mudrost", "Veličina"], correctIndex: 1, objasnjenje: "Islam znači mir i predanost Allahu.", tezina: 2 },
  { pitanje: "Vjerovanje u poslanike je koji imanski šart?", opcije: ["Drugi", "Treći", "Četvrti", "Peti"], correctIndex: 2, objasnjenje: "Četvrti imanski šart je vjerovanje u Allahove poslanike.", tezina: 2 },
  { pitanje: "Koji je drugi islamski šart?", opcije: ["Post", "Namaz", "Zekat", "Hadž"], correctIndex: 1, objasnjenje: "Drugi islamski šart je obavljanje pet dnevnih namaza." },
  { pitanje: "Koji islamski šart se obavlja u mjesecu Ramazanu?", opcije: ["Namaz", "Zekat", "Post", "Hadž"], correctIndex: 2, objasnjenje: "Post (sawm) se obavlja u Ramazanu — treći islamski šart." },
  { pitanje: "Šta je zekat?", opcije: ["Dobrovoljna milostinja", "Obavezna godišnja milostinja", "Post", "Dova"], correctIndex: 1, objasnjenje: "Zekat je obavezno godišnje davanje siromašnima — četvrti islamski šart.", tezina: 2 },
  { pitanje: "Koliko ima šarta abdesta (faraida)?", opcije: ["Tri", "Četiri", "Pet", "Šest"], correctIndex: 1, objasnjenje: "Abdest ima četiri farda: pranje lica, ruku do laktova, mes-h glave i pranje nogu do gležnjeva.", tezina: 2 },
  { pitanje: "Koja je prva rečenica koju musliman izgovara da postane musliman?", opcije: ["Bismillah", "Elhamdulillah", "Kelime-i šehadet", "Subhanallah"], correctIndex: 2, objasnjenje: "Kelime-i šehadet: 'Ešhedu en la ilahe illallah, ve ešhedu enne Muhammeden abduhu ve resuluhu.'" },
  { pitanje: "Vjerovanje u koga je PRVI imanski šart?", opcije: ["U meleke", "U Allaha", "U poslanike", "U Sudnji dan"], correctIndex: 1, objasnjenje: "Prvi imanski šart je vjerovanje u Allaha — Jednog jedinog Boga." },
  { pitanje: "Koliko ima vadžiba namaza?", opcije: ["Tri", "Pet", "Šest", "Četrnaest"], correctIndex: 3, objasnjenje: "Vadžiba namaza, prema hanefijskom mezhebu, ima oko 14 — uče se postepeno.", tezina: 3 },
];

// === SURE I AJETI ===============================================================
const SURE: SeedPitanje[] = [
  { pitanje: "Koliko sura ima Kur'an?", opcije: ["110", "112", "114", "120"], correctIndex: 2, objasnjenje: "Kur'an ima ukupno 114 sura." },
  { pitanje: "Koja je prva sura u Kur'anu?", opcije: ["El-Bekare", "El-Fatiha", "Jasin", "El-Ihlas"], correctIndex: 1, objasnjenje: "El-Fatiha (Pristup) je prva sura, učimo je u svakom rekatu namaza." },
  { pitanje: "Koliko ajeta ima sura El-Fatiha?", opcije: ["Pet", "Šest", "Sedam", "Osam"], correctIndex: 2, objasnjenje: "El-Fatiha ima sedam ajeta." },
  { pitanje: "Koja sura govori o Allahovoj Jednoći (tewhidu)?", opcije: ["El-Felek", "En-Nas", "El-Ihlas", "El-Kevser"], correctIndex: 2, objasnjenje: "Sura El-Ihlas (Iskrenost) jasno govori o Allahovoj Jednoći." },
  { pitanje: "Koliko ajeta ima sura El-Ihlas?", opcije: ["Tri", "Četiri", "Pet", "Šest"], correctIndex: 1, objasnjenje: "Sura El-Ihlas ima četiri ajeta — kratka ali velikog značenja." },
  { pitanje: "Koja je najduža sura u Kur'anu?", opcije: ["Jasin", "El-Bekare", "Ali Imran", "En-Nisa"], correctIndex: 1, objasnjenje: "El-Bekare (Krava) je najduža sura — ima 286 ajeta.", tezina: 2 },
  { pitanje: "Koja je najkraća sura u Kur'anu?", opcije: ["El-Kevser", "El-Asr", "El-Ihlas", "El-Felek"], correctIndex: 0, objasnjenje: "El-Kevser ima samo tri kratka ajeta — najkraća sura.", tezina: 2 },
  { pitanje: "Koja sura se zove 'srce Kur'ana'?", opcije: ["El-Fatiha", "Jasin", "Er-Rahman", "El-Mulk"], correctIndex: 1, objasnjenje: "Sura Jasin se naziva 'srce Kur'ana' (kalbu-l-Kur'an).", tezina: 2 },
  { pitanje: "Posljednje dvije sure u Kur'anu (El-Felek i En-Nas) zovu se?", opcije: ["Mukatta'at", "Mu'avvizetejni", "Mufessal", "Tewhid"], correctIndex: 1, objasnjenje: "Mu'avvizetejni — dvije sure zaštite od svakog zla.", tezina: 3 },
  { pitanje: "Koja sura počinje riječima 'Bismillahir-Rahmanir-Rahim' kao prvi ajet?", opcije: ["El-Ihlas", "El-Fatiha", "El-Kevser", "El-Asr"], correctIndex: 1, objasnjenje: "U suri El-Fatiha 'Bismillah' je prvi od sedam ajeta.", tezina: 3 },
  { pitanje: "Koji ajet se zove 'Ajetu-l-Kursij' (Ajet o Prijestolju)?", opcije: ["255. ajet sure El-Bekare", "1. ajet sure Jasin", "10. ajet sure En-Nur", "Prvi ajet El-Fatihe"], correctIndex: 0, objasnjenje: "Ajetu-l-Kursij je 255. ajet sure El-Bekare, govori o Allahovom Prijestolju i veličini.", tezina: 3 },
  { pitanje: "Koja sura govori o milosti (Er-Rahman) i ima ponavljajući ajet 'Pa koju blagodat Gospodara svoga poričete?'", opcije: ["Er-Rahman", "El-Vakia", "El-Mulk", "El-Hadid"], correctIndex: 0, objasnjenje: "Sura Er-Rahman (Milostivi) — taj refren se ponavlja 31 put.", tezina: 2 },
  { pitanje: "U kojoj suri se spominje noćno putovanje Poslanika a.s. (Isra)?", opcije: ["El-Bekare", "El-Isra", "El-Kahf", "Mejjm"], correctIndex: 1, objasnjenje: "Sura El-Isra počinje opisom Poslanikova noćnog putovanja iz Mekke u Jerusalem.", tezina: 2 },
  { pitanje: "U kojoj suri je priča o ljudima iz pećine (Ashabu-l-Kehf)?", opcije: ["Jusuf", "El-Kahf", "Mejjm", "El-Enbija"], correctIndex: 1, objasnjenje: "Sura El-Kahf (Pećina) priča o sedmero mladića koji su zaspali u pećini.", tezina: 2 },
  { pitanje: "Sura koja nosi ime jednog Poslanika i priča cijelu njegovu životnu priču u jednoj suri?", opcije: ["Jusuf", "Nuh", "Hud", "Muhammed"], correctIndex: 0, objasnjenje: "Sura Jusuf priča kompletnu priču o Jusufu a.s. od djetinjstva do susreta sa ocem.", tezina: 2 },
  { pitanje: "Koja sura se uči obavezno u svakom rekatu namaza?", opcije: ["El-Ihlas", "El-Fatiha", "El-Kevser", "Bilo koja"], correctIndex: 1, objasnjenje: "El-Fatiha se uči u SVAKOM rekatu — bez nje namaz nije ispravan." },
  { pitanje: "Šta znači riječ 'sura'?", opcije: ["Ajet", "Poglavlje Kur'ana", "Slovo", "Knjiga"], correctIndex: 1, objasnjenje: "Sura je poglavlje, dio Kur'ana." },
  { pitanje: "Šta znači riječ 'ajet'?", opcije: ["Stih ili znak", "Sura", "Slovo", "Riječ"], correctIndex: 0, objasnjenje: "Ajet doslovno znači 'znak' — svaki ajet je jedan stih i znak Allahove mudrosti." },
  { pitanje: "Sura Jasin pripada kojem dijelu Kur'ana po dužini sura?", opcije: ["Vrlo kratke sure", "Srednje sure", "Najduže sure", "Mukatta'at"], correctIndex: 1, objasnjenje: "Sura Jasin ima 83 ajeta — srednje dužine.", tezina: 3 },
  { pitanje: "U koliko godina je Kur'an objavljivan Poslaniku a.s.?", opcije: ["10", "13", "20", "23"], correctIndex: 3, objasnjenje: "Kur'an je objavljivan postepeno tokom 23 godine Poslanikove misije.", tezina: 2 },
];

// === DOVE I ZIKROVI =============================================================
const DOVE: SeedPitanje[] = [
  { pitanje: "Šta je dova?", opcije: ["Vrsta namaza", "Obraćanje Allahu", "Naziv mjeseca", "Sastav Kur'ana"], correctIndex: 1, objasnjenje: "Dova je obraćanje Allahu, traženje pomoći i dobra od Njega." },
  { pitanje: "Koje riječi izgovaramo prije početka jela?", opcije: ["Elhamdulillah", "Bismillah", "Subhanallah", "Allahu ekber"], correctIndex: 1, objasnjenje: "Bismillah (U ime Allaha) izgovaramo prije svakog dobrog djela, pa i jela." },
  { pitanje: "Koje riječi izgovaramo poslije jela?", opcije: ["Bismillah", "Inšaallah", "Elhamdulillah", "Estagfirullah"], correctIndex: 2, objasnjenje: "Elhamdulillah (Hvala Allahu) izgovaramo nakon jela u znak zahvalnosti." },
  { pitanje: "Šta znači 'Subhanallah'?", opcije: ["Allah je Najveći", "Slava Allahu", "Hvala Allahu", "Nema boga osim Allaha"], correctIndex: 1, objasnjenje: "Subhanallah znači 'Slava Allahu' — Allah je čist od svih nedostataka." },
  { pitanje: "Šta znači 'Allahu ekber'?", opcije: ["Allah je Najveći", "Allah je Milostivi", "Allah je Jedan", "Hvala Allahu"], correctIndex: 0, objasnjenje: "Allahu ekber znači 'Allah je Najveći' — izgovaramo na početku namaza i pri svakom prelazu." },
  { pitanje: "Šta znači 'Estagfirullah'?", opcije: ["Hvala Allahu", "Tražim oprost od Allaha", "Slava Allahu", "Allah je Velik"], correctIndex: 1, objasnjenje: "Estagfirullah znači 'Tražim oprost od Allaha' — često ga ponavljamo nakon grijeha.", tezina: 2 },
  { pitanje: "Šta znači 'Inšaallah'?", opcije: ["Hvala Allahu", "Ako Allah da", "Allah zna", "Allah oprosti"], correctIndex: 1, objasnjenje: "Inšaallah znači 'Ako Allah da' — kažemo kad planiramo nešto za budućnost." },
  { pitanje: "Šta znači 'Mašallah'?", opcije: ["Allah je htio", "Allah oprosti", "Hvala Allahu", "Slava Allahu"], correctIndex: 0, objasnjenje: "Mašallah znači 'Šta je Allah htio' — kažemo kad vidimo nešto lijepo, da nas Allah sačuva uroka." },
  { pitanje: "Koju dovu uči Poslanik a.s. prije spavanja (kratka)?", opcije: ["Bismika Allahumme emutu ve ahja", "Allahumme barik lena", "Bismillah we 'ala milleti resulillah", "Estagfirullah el-'azim"], correctIndex: 0, objasnjenje: "Bismike Allahumme emutu ve ahja — 'U Tvoje ime, Allahu, umirem i živim.'", tezina: 3 },
  { pitanje: "Koju dovu uči Poslanik a.s. ujutro nakon buđenja?", opcije: ["Bismillah", "Elhamdulillahillezi ahjana ba'de ma ematena", "Subhanallah", "Estagfirullah"], correctIndex: 1, objasnjenje: "Elhamdulillahillezi ahjana ba'de ma ematena — 'Hvala Allahu koji nas je oživio nakon što nas je usmrtio (snom).'", tezina: 3 },
  { pitanje: "Šta kažemo kada se kihne?", opcije: ["Bismillah", "Elhamdulillah", "Subhanallah", "Allahu ekber"], correctIndex: 1, objasnjenje: "Onaj ko kihne kaže 'Elhamdulillah'. Onaj ko čuje uzvraća: 'Jerhamukellah' (Allah ti se smilovao)." },
  { pitanje: "Koji se zikr ponavlja nakon farz namaza 33 puta?", opcije: ["Bismillah", "Subhanallah", "La ilahe illallah", "Salavat"], correctIndex: 1, objasnjenje: "Nakon farz namaza: Subhanallah (33), Elhamdulillah (33), Allahu ekber (33 ili 34) — Tesbih.", tezina: 2 },
  { pitanje: "Koliko puta se ponavlja Elhamdulillah u tesbihu nakon namaza?", opcije: ["7", "11", "33", "100"], correctIndex: 2, objasnjenje: "Elhamdulillah se ponavlja 33 puta u tesbihu nakon farz namaza.", tezina: 2 },
  { pitanje: "Šta znači 'salavat na Poslanika'?", opcije: ["Klanjanje", "Pozdrav i blagoslov za Poslanika a.s.", "Post", "Hadž"], correctIndex: 1, objasnjenje: "Salavat: Allahumme salli ala Muhammed... — molba Allahu da blagoslovi Poslanika.", tezina: 2 },
  { pitanje: "Koji je najveći zikr (spominjanje Allaha)?", opcije: ["La ilahe illallah", "Allahu ekber", "Elhamdulillah", "Subhanallah"], correctIndex: 0, objasnjenje: "'La ilahe illallah' (Nema boga osim Allaha) je najbolji zikr prema hadisu Poslanika a.s.", tezina: 2 },
  { pitanje: "Šta kažemo kad uđemo u kuću?", opcije: ["Esselamu alejkum (uz Bismillah)", "Allahu ekber", "Subhanallah", "Inšaallah"], correctIndex: 0, objasnjenje: "Selam ukućanima i Bismillah pri ulasku — i ako kuća prazna, selam upućujemo melekima koji čuvaju kuću.", tezina: 2 },
  { pitanje: "Šta kažemo kad ulazimo u WC?", opcije: ["Bismillah", "Allahumme inni e'uzu bike minel-hubsi vel-habais", "Selam", "Elhamdulillah"], correctIndex: 1, objasnjenje: "'Allahu, utičem Ti se od šejtana muškog i ženskog roda.'", tezina: 3 },
  { pitanje: "Koja sura se uči kao zaštita od zla?", opcije: ["El-Fatiha", "El-Felek i En-Nas", "El-Ihlas", "El-Kevser"], correctIndex: 1, objasnjenje: "El-Felek i En-Nas (Mu'avvizetejni) — dvije sure zaštite koje Poslanik a.s. preporučio." },
  { pitanje: "Šta znači 'La havle vela kuvvete illa billah'?", opcije: ["Nema sile ni moći osim u Allaha", "Hvala Allahu", "Slava Allahu", "Allah je Najveći"], correctIndex: 0, objasnjenje: "'Nema preokretanja niti snage osim Allahovom voljom' — riznica iz Dženneta, kažu hadisi.", tezina: 3 },
  { pitanje: "Koja dova se preporučuje kad putujemo?", opcije: ["Subhanallezi sehhare lena haza", "Bismillah we 'ala milleti", "La ilahe illa Allah", "Elhamdulillah"], correctIndex: 0, objasnjenje: "'Slavljen neka je Onaj koji nam je ovo potčinio' — dova kad ulazimo u prevozno sredstvo.", tezina: 3 },
];

// === NAMAZ I IBADETI ============================================================
const NAMAZ: SeedPitanje[] = [
  { pitanje: "Koliko ima dnevnih farz namaza?", opcije: ["Tri", "Četiri", "Pet", "Šest"], correctIndex: 2, objasnjenje: "Pet dnevnih namaza: sabah, podne, ikindija, akšam i jacija." },
  { pitanje: "Koliko rekata ima sabah-namaz (farz)?", opcije: ["Dva", "Tri", "Četiri", "Pet"], correctIndex: 0, objasnjenje: "Sabah farz ima dva rekata. (Plus dva sunneta prije.)" },
  { pitanje: "Koliko rekata ima podne-namaz (samo farz)?", opcije: ["Dva", "Tri", "Četiri", "Šest"], correctIndex: 2, objasnjenje: "Farz podne namaza ima četiri rekata.", tezina: 2 },
  { pitanje: "Koliko rekata ima akšam-namaz (farz)?", opcije: ["Dva", "Tri", "Četiri", "Pet"], correctIndex: 1, objasnjenje: "Akšam farz ima tri rekata — jedinstvo među svim namazima." },
  { pitanje: "Koliko rekata ima jacija-namaz (farz)?", opcije: ["Dva", "Tri", "Četiri", "Pet"], correctIndex: 2, objasnjenje: "Jacija farz ima četiri rekata. (Plus vitr nakon nje.)", tezina: 2 },
  { pitanje: "Koji namaz se klanja petkom umjesto podne-namaza?", opcije: ["Bajram namaz", "Vitr", "Džuma", "Teravih"], correctIndex: 2, objasnjenje: "Džuma namaz se klanja petkom u džematu umjesto podnevskog farza." },
  { pitanje: "Koliko rekata farza ima džuma-namaz?", opcije: ["Dva", "Tri", "Četiri", "Pet"], correctIndex: 0, objasnjenje: "Džuma farz ima dva rekata, klanja se u džematu nakon hutbe.", tezina: 2 },
  { pitanje: "Koji namaz se klanja samo u Ramazanu nakon jacije?", opcije: ["Vitr", "Tehedždžud", "Teravih", "Duha"], correctIndex: 2, objasnjenje: "Teravih namaz se klanja samo u Ramazanu, obično 20 ili 8 rekata." },
  { pitanje: "Šta je Kable u namazu?", opcije: ["Sunnet prije farza", "Sunnet poslije farza", "Vrsta sedžde", "Vitr"], correctIndex: 0, objasnjenje: "'Kable' znači 'prije' — sunnet koji se klanja prije farza.", tezina: 2 },
  { pitanje: "Šta je 'kira'et' u namazu?", opcije: ["Selam", "Učenje Kur'ana", "Sedžda", "Stojanje"], correctIndex: 1, objasnjenje: "Kira'et je učenje Kur'ana (El-Fatihe i druge sure) u namazu.", tezina: 2 },
  { pitanje: "Šta je 'sedžda'?", opcije: ["Stojanje", "Sjedenje", "Pad ničice (čelo na tlu)", "Naklon"], correctIndex: 2, objasnjenje: "Sedžda je padanje ničice — čelo, nos, dlanovi, koljena i prsti nogu na tlu." },
  { pitanje: "Koliko sedžda ima u jednom rekatu?", opcije: ["Jedna", "Dvije", "Tri", "Četiri"], correctIndex: 1, objasnjenje: "Svaki rekat sadrži dvije sedžde između kojih je kratko sjedenje." },
  { pitanje: "Šta je 'tešehud'?", opcije: ["Početni tekbir", "Sjedenje sa učenjem 'Et-Tehijjatu'", "Selam na kraju", "Ruku"], correctIndex: 1, objasnjenje: "Tešehud je sjedenje na drugom (i posljednjem) rekatu sa učenjem 'Et-Tehijjatu'.", tezina: 3 },
  { pitanje: "U kojem dijelu dana se klanja ikindija?", opcije: ["Ujutro", "Oko podne", "Poslijepodne (prije zalaska sunca)", "Kad padne mrak"], correctIndex: 2, objasnjenje: "Ikindija se klanja u poslijepodnevnim satima, prije zalaska sunca." },
  { pitanje: "Šta je 'ezan'?", opcije: ["Učenje u namazu", "Poziv na namaz", "Sedžda", "Selam"], correctIndex: 1, objasnjenje: "Ezan je glasni poziv na namaz koji uči mujezin sa munare." },
  { pitanje: "Šta je 'ikamet'?", opcije: ["Drugi poziv neposredno prije početka namaza", "Selam", "Sedžda", "Sunnet"], correctIndex: 0, objasnjenje: "Ikamet je drugi, kraći poziv koji se uči prije nego klanjamo (u džematu i sami).", tezina: 2 },
  { pitanje: "U kojem pravcu se okreće musliman pri namazu (Kibla)?", opcije: ["Prema istoku", "Prema Mekki (Kabi)", "Prema sjeveru", "Prema zapadu"], correctIndex: 1, objasnjenje: "Kibla je pravac prema Kabi u Mekki — svaki namaz okrećemo se prema njoj." },
  { pitanje: "Šta je 'tejjemmum'?", opcije: ["Suhi abdest sa čistom zemljom", "Vrsta namaza", "Selam", "Dova"], correctIndex: 0, objasnjenje: "Tejjemmum je suhi abdest sa čistom zemljom kad nema vode ili je opasno koristiti je.", tezina: 3 },
  { pitanje: "Koliko rekata ima vitr-namaz?", opcije: ["Jedan", "Dva", "Tri", "Pet"], correctIndex: 2, objasnjenje: "Vitr je vadžib namaz od tri rekata, klanja se nakon jacije.", tezina: 2 },
  { pitanje: "Šta je 'gusul'?", opcije: ["Mali abdest", "Veliki abdest (kupanje)", "Tejjemmum", "Mes-h glave"], correctIndex: 1, objasnjenje: "Gusul je veliko kupanje — pranje cijelog tijela kad je propisano (npr. nakon menstruacije, dženabeta).", tezina: 2 },
];

// === LIJEPO PONAŠANJE (ahlak) ===================================================
const PONASANJE: SeedPitanje[] = [
  { pitanje: "Šta je lijepo reći kad sretnemo muslimana?", opcije: ["Dobar dan", "Esselamu alejkum", "Dobro jutro", "Pozdrav"], correctIndex: 1, objasnjenje: "Selam je islamski pozdrav i dova: 'Mir s tobom.'" },
  { pitanje: "Kako odgovaramo na 'Esselamu alejkum'?", opcije: ["Dobro jutro", "Inšaallah", "We alejkumus-selam", "Mašallah"], correctIndex: 2, objasnjenje: "We alejkumus-selam (we rahmetullahi we berekatuhu) — uzvraćanje sa istim ili boljim pozdravom je obaveza." },
  { pitanje: "Kojom rukom musliman jede prema sunnetu?", opcije: ["Lijevom", "Desnom", "Obje su iste", "Bilo kojom"], correctIndex: 1, objasnjenje: "Sunnet je jesti, piti i davati desnom rukom." },
  { pitanje: "Koje je najljepše djelo prema roditeljima?", opcije: ["Slušati ih i biti dobar prema njima", "Davati im novac", "Putovati sa njima", "Klanjati za njih"], correctIndex: 0, objasnjenje: "Poslušnost roditeljima i lijepo ophođenje — Allah je u Kur'anu naredio dobrotu prema njima odmah nakon ibadeta Njemu." },
  { pitanje: "Šta moramo izbjegavati u govoru?", opcije: ["Lijepe riječi", "Laganje i ogovaranje", "Dovu", "Selam"], correctIndex: 1, objasnjenje: "Laž, ogovaranje (gibet) i prenošenje (nemmime) su veliki grijesi." },
  { pitanje: "Šta je 'gibet'?", opcije: ["Nagrada", "Ogovaranje muslimana iza leđa", "Vrsta namaza", "Lijepa riječ"], correctIndex: 1, objasnjenje: "Gibet je spominjanje brata muslimana po onom što ne voli — Kur'an ga poredi sa jedenjem mesa mrtvog brata.", tezina: 2 },
  { pitanje: "Koliko ima 'prava puta' kod muslimana — koliko su pravo komšija?", opcije: ["Komšije nemaju posebno pravo", "Komšija ima veliko pravo", "Samo bliža rodbina", "Samo muslimani"], correctIndex: 1, objasnjenje: "Komšija ima veliko pravo, čak i ako je nemusliman. Poslanik a.s. je rekao: 'Tako mi Allaha, nije vjernik, tako mi Allaha, nije vjernik onaj čiji komšija nije siguran od njegovog zla.'", tezina: 2 },
  { pitanje: "Šta uradimo kad nas neko počasti hranom?", opcije: ["Pojedemo bez riječi", "Zahvalimo se i kažemo lijepu dovu za njega", "Odbijemo", "Tražimo više"], correctIndex: 1, objasnjenje: "Dova za onog ko nas počasti je sunnet — 'Allahumme barik lehum...' (Allahu, blagoslovi im hranu)." },
  { pitanje: "Kako tretiramo mlađe od sebe?", opcije: ["Strogo i bez pažnje", "Sa nježnošću i samilošću", "Ignoriramo ih", "Naređujemo im"], correctIndex: 1, objasnjenje: "Poslanik a.s.: 'Ko nije milostiv prema mlađima i ne poštuje starije — nije od nas.'" },
  { pitanje: "Kako tretiramo starije?", opcije: ["Bilo kako", "Sa poštovanjem i strpljenjem", "Izbjegavamo ih", "Ismijavamo ih"], correctIndex: 1, objasnjenje: "Poštovanje starijih je obaveza — to je dio islamskog odgoja." },
  { pitanje: "Šta uradimo ako vidimo nešto na putu što smeta drugima (kamen, granu)?", opcije: ["Ostavimo to", "Sklonimo to sa puta", "Nazovemo nekog", "Pređemo dalje"], correctIndex: 1, objasnjenje: "Uklanjanje smetnje sa puta je sadaka i dio imana — hadis Poslanika a.s." },
  { pitanje: "Šta čini muslimana boljim u očima Allaha?", opcije: ["Bogatstvo", "Bogobojaznost (takvaluk)", "Lijepa odjeća", "Mnogo prijatelja"], correctIndex: 1, objasnjenje: "'Najugledniji kod Allaha je onaj koji se Allaha najviše boji.' (El-Hudžurat, 13)" },
  { pitanje: "Šta je 'sadaka'?", opcije: ["Obavezna milostinja", "Dobrovoljno davanje siromašnima", "Vrsta namaza", "Post"], correctIndex: 1, objasnjenje: "Sadaka je dobrovoljno davanje (zekat je obavezno). Čak i osmijeh bratu je sadaka." },
  { pitanje: "Šta je laž prema islamu?", opcije: ["Mala stvar", "Veliki grijeh i znak licemjerstva", "Dozvoljeno u igri", "Sadaka"], correctIndex: 1, objasnjenje: "Laž je veliki grijeh; tri su znaka licemjera: kad govori — laže, kad obeća — ne ispuni, kad mu se povjeri — iznevjeri." },
  { pitanje: "Šta uradimo kad pogriješimo prema nekome?", opcije: ["Sakrijemo grešku", "Izvinemo se i tražimo halala", "Krivimo druge", "Zaboravimo"], correctIndex: 1, objasnjenje: "Tražiti halal (oprost) je dio lijepog ahlaka — Allah ne oprašta tuđa prava dok ih čovjek ne podmiri." },
  { pitanje: "Kako se prema islamu tretiraju životinje?", opcije: ["Sa nemarom", "Sa milošću i pažnjom", "Bilo kako", "Treba ih ostaviti"], correctIndex: 1, objasnjenje: "Pojesna je žena ušla u Džennet zbog psa kojeg je napojila, a druga u Džehennem zbog mačke koju je gladnom uvezala." },
  { pitanje: "Koja je vrijednost osmijeha bratu muslimanu?", opcije: ["Nema vrijednosti", "Jednako sadaki", "Grijeh", "Nije bitno"], correctIndex: 1, objasnjenje: "Poslanik a.s.: 'Tvoj osmijeh bratu je sadaka.'" },
  { pitanje: "Šta uradimo kada gosti dolaze?", opcije: ["Ignoriramo ih", "Lijepo dočekamo i ugostimo", "Pošaljemo ih dalje", "Tražimo dar"], correctIndex: 1, objasnjenje: "Gostoljubivost je dio imana: 'Ko vjeruje u Allaha i Sudnji dan neka počasti svog gosta.'" },
  { pitanje: "Kako musliman čuva tajnu koja mu je povjerena?", opcije: ["Ispriča svima", "Čuva i ne odaje je", "Kaže porodici", "Zavisi od raspoloženja"], correctIndex: 1, objasnjenje: "Iznevjeravanje povjerenog je znak licemjerstva i veliki grijeh." },
  { pitanje: "Koje je pravilo o pomaganju drugima?", opcije: ["Pomažemo samo svojima", "Pomažemo svakome ko nam treba ako možemo", "Ne pomažemo nikome", "Pomažemo za nagradu"], correctIndex: 1, objasnjenje: "'Najbolji ljudi su oni koji su najkorisniji ljudima.' — hadis Poslanika a.s." },
];

// === HALAL I HARAM ==============================================================
const HALAL_HARAM: SeedPitanje[] = [
  { pitanje: "Šta znači 'halal'?", opcije: ["Zabranjeno", "Dozvoljeno (po islamu)", "Obavezno", "Pokuđeno"], correctIndex: 1, objasnjenje: "Halal znači dozvoljeno — ono što je islam dozvolio." },
  { pitanje: "Šta znači 'haram'?", opcije: ["Dozvoljeno", "Strogo zabranjeno (po islamu)", "Obavezno", "Sumnjivo"], correctIndex: 1, objasnjenje: "Haram znači zabranjeno — činjenje harama je grijeh." },
  { pitanje: "Koje meso je haram?", opcije: ["Pileće", "Govedije", "Svinjsko", "Janjetina"], correctIndex: 2, objasnjenje: "Svinjsko meso je strogo zabranjeno — Allah to jasno spominje u Kur'anu." },
  { pitanje: "Koje piće je haram?", opcije: ["Voda", "Mlijeko", "Sok od jabuke", "Alkohol"], correctIndex: 3, objasnjenje: "Alkohol je 'majka svih grijeha' — strogo haram, izaziva pijanstvo i sve loše." },
  { pitanje: "Da li je dozvoljeno jesti meso životinje koja nije zaklana po islamskim propisima?", opcije: ["Da, uvijek", "Ne — meso mora biti zaklano u ime Allaha", "Samo ako je svježe", "Zavisi od mjesta"], correctIndex: 1, objasnjenje: "Životinja se kolje izgovaranjem 'Bismillah, Allahu ekber' — meso 'mejjta' (uginule) je haram.", tezina: 2 },
  { pitanje: "Da li je kockanje haram?", opcije: ["Halal", "Haram", "Sumnjivo", "Samo nekad"], correctIndex: 1, objasnjenje: "Kockanje (mejsir) je strogo haram — Kur'an ga zabranjuje uz alkohol u istim ajetima." },
  { pitanje: "Da li je laganje haram?", opcije: ["Da, veliki je grijeh", "Halal", "Sitnica", "Zavisi"], correctIndex: 0, objasnjenje: "Laž je haram — vodi u sve druge grijehe i znak je licemjerstva." },
  { pitanje: "Da li je krasti haram?", opcije: ["Halal", "Haram", "Mekruh", "Mubah"], correctIndex: 1, objasnjenje: "Krađa je haram — narušava povjerenje i pravo drugoga, čak postoji i hadd kazna za nju." },
  { pitanje: "Šta je 'kamata' u islamu?", opcije: ["Halal zarada", "Haram (riba) — strogo zabranjena", "Obavezna", "Dobra stvar"], correctIndex: 1, objasnjenje: "Riba (kamata) je strogo zabranjena — Allah u Kur'anu obećava rat onome ko se kamatom bavi.", tezina: 2 },
  { pitanje: "Da li je dozvoljeno ulagati u alkoholne kompanije?", opcije: ["Da", "Ne, novac od harama je haram", "Samo malo", "Zavisi od kompanije"], correctIndex: 1, objasnjenje: "Sve što potpomaže haram je također haram — princip 'sredstvo prati cilj'.", tezina: 3 },
  { pitanje: "Šta je 'mekruh'?", opcije: ["Strogo zabranjeno", "Pokuđeno (treba izbjegavati ali nije haram)", "Obavezno", "Dozvoljeno"], correctIndex: 1, objasnjenje: "Mekruh je pokuđeno — nije strogo haram, ali bolje izbjegavati.", tezina: 2 },
  { pitanje: "Šta je 'farz'?", opcije: ["Pokuđeno", "Dozvoljeno", "Strogo obavezno (ostavljanje je grijeh)", "Sumnjivo"], correctIndex: 2, objasnjenje: "Farz je strogo obavezno — npr. pet dnevnih namaza, post u Ramazanu.", tezina: 2 },
  { pitanje: "Da li je vrijeđanje drugih haram?", opcije: ["Halal", "Haram", "Mubah", "Sunnet"], correctIndex: 1, objasnjenje: "Vrijeđanje, ismijavanje i nazivanje pogrdnim imenima — sve je haram. Kur'an u suri El-Hudžurat to zabranjuje." },
  { pitanje: "Da li su tetovaže (po tijelu) dozvoljene u islamu?", opcije: ["Da, uvijek", "Ne — haram, mijenjanje stvorenog", "Samo male", "Samo na rukama"], correctIndex: 1, objasnjenje: "Trajne tetovaže su haram — to je trajno mijenjanje Allahovog stvorenja.", tezina: 2 },
  { pitanje: "Šta uradimo ako sumnjamo da li je nešto halal ili haram?", opcije: ["Uradimo svejedno", "Ostavimo iz opreza i pitamo učenog", "Pitamo prijatelje", "Glasamo"], correctIndex: 1, objasnjenje: "'Ostavi sumnjivo radi onog što nije sumnjivo.' — hadis Poslanika a.s.", tezina: 2 },
  { pitanje: "Šta je dozvoljena ishrana u Ramazanu prije sabaha (sehur)?", opcije: ["Bilo šta halal", "Samo voda", "Samo voće", "Ništa"], correctIndex: 0, objasnjenje: "Sehur (jelo prije sabaha) je sunnet — bilo koja halal hrana, čak i mali zalogaj." },
  { pitanje: "Da li je dozvoljeno baciti hranu?", opcije: ["Da, ako je nepojesta", "Ne, rasipanje hrane je grijeh", "Samo malu količinu", "Samo voće"], correctIndex: 1, objasnjenje: "Rasipanje (israf) je strogo pokuđeno; čak je hadis: 'Liznite prste i tanjir.'" },
  { pitanje: "Da li je glazba dozvoljena u islamu? (oprezno pitanje)", opcije: ["Sva glazba je halal", "Sva glazba je haram", "Oko ovoga ulema različito misli", "Samo bubnjevi"], correctIndex: 2, objasnjenje: "Pitanje glazbe je predmet razlike među učenjacima — ilahije i nasheedi su prihvaćeni, neumjerena instrumentalna muzika sa lošim sadržajem se smatra haramom.", tezina: 3 },
  { pitanje: "Šta uradimo sa novcem koji je zarađen na haram način (npr. krađom)?", opcije: ["Zadržimo", "Vratimo vlasniku ili damo siromasima", "Potrošimo brzo", "Damo rodbini"], correctIndex: 1, objasnjenje: "Vraćanje haram novca pravom vlasniku je obaveza; ako to nije moguće, daje se kao sadaka bez nijjeta nagrade.", tezina: 3 },
  { pitanje: "Šta je 'mubah'?", opcije: ["Obavezno", "Zabranjeno", "Dozvoljeno bez nagrade i kazne", "Pokuđeno"], correctIndex: 2, objasnjenje: "Mubah znači potpuno dozvoljeno — npr. izbor jela koje volimo (od halal opcija).", tezina: 3 },
];

// === ISLAMSKA HISTORIJA =========================================================
const HISTORIJA: SeedPitanje[] = [
  { pitanje: "Kako se zvao posljednji Allahov Poslanik?", opcije: ["Isa, a.s.", "Musa, a.s.", "Muhammed, a.s.", "Ibrahim, a.s."], correctIndex: 2, objasnjenje: "Muhammed a.s. je posljednji Allahov Poslanik (Hatemu-n-nebijjin)." },
  { pitanje: "U kojem gradu je rođen Muhammed a.s.?", opcije: ["Medina", "Mekka", "Jerusalem", "Bagdad"], correctIndex: 1, objasnjenje: "Poslanik a.s. je rođen u Mekki, oko 570. godine." },
  { pitanje: "Koliko je godina imao Muhammed a.s. kad je primio prvu objavu?", opcije: ["25", "30", "40", "50"], correctIndex: 2, objasnjenje: "Prva objava došla je u 40. godini Poslanikova života, u pećini Hira." },
  { pitanje: "U kojoj pećini je Poslanik a.s. primio prvu objavu?", opcije: ["Sevr", "Hira", "Uhud", "Bedr"], correctIndex: 1, objasnjenje: "U pećini Hira na brdu Džebelu-n-nur, melek Džibril mu je donio prve ajete." },
  { pitanje: "Koja je bila prva objavljena sura?", opcije: ["El-Fatiha", "El-'Alek (Ikre')", "El-Bekare", "Jasin"], correctIndex: 1, objasnjenje: "Sura El-'Alek, prvih pet ajeta — počinje sa 'Ikre' (Čitaj!).", tezina: 2 },
  { pitanje: "Kako se zvala prva žena Muhammeda a.s. i prva muslimanka?", opcije: ["Aiša", "Hatidža", "Fatima", "Sumejja"], correctIndex: 1, objasnjenje: "Hatidža r.a. — prva supruga, prva muslimanka, podrška Poslaniku u najtežim trenucima." },
  { pitanje: "Kako se zvala kćerka Poslanika a.s. od koje potiče loza Hasana i Husejna?", opcije: ["Aiša", "Hatidža", "Fatima", "Zejneba"], correctIndex: 2, objasnjenje: "Fatima r.a. je bila supruga Alije r.a. i majka Hasana i Husejna." },
  { pitanje: "Šta je 'Hidžra'?", opcije: ["Selidba Poslanika a.s. iz Mekke u Medinu", "Bitka", "Ime brda", "Ime ashaba"], correctIndex: 0, objasnjenje: "Hidžra (622. godine) je seoba muslimana iz Mekke u Medinu — početak islamskog kalendara.", tezina: 2 },
  { pitanje: "Iz koje godine počinje islamski (hidžretski) kalendar?", opcije: ["570.", "610.", "622.", "632."], correctIndex: 2, objasnjenje: "622. godina nove ere = 1. hidžretska godina. Hidžra je tačka broj 0 islamskog kalendara.", tezina: 2 },
  { pitanje: "U kojem gradu je umro i ukopan Muhammed a.s.?", opcije: ["Mekka", "Medina", "Jerusalem", "Damask"], correctIndex: 1, objasnjenje: "Poslanik a.s. je umro 632. godine u Medini, ukopan je u sobi Aiše r.a. — danas je to Mesdžidu-n-Nebevi." },
  { pitanje: "Ko je bio prvi halifa nakon Poslanika a.s.?", opcije: ["Omer", "Osman", "Alija", "Ebu Bekr"], correctIndex: 3, objasnjenje: "Ebu Bekr es-Siddik r.a. je bio prvi pravedni halifa, najbliži prijatelj Poslanika a.s." },
  { pitanje: "Ko je bio drugi pravedni halifa, poznat po pravdi?", opcije: ["Omer ibn Hattab", "Osman", "Alija", "Hamza"], correctIndex: 0, objasnjenje: "Omer r.a. je vladao 10 godina (634-644), širio islam do Egipta, Sirije, Iraka.", tezina: 2 },
  { pitanje: "Koja je bila prva velika bitka muslimana protiv mušrika Mekke?", opcije: ["Bitka na Hendeku", "Bitka na Bedru", "Bitka na Uhudu", "Bitka na Hajberu"], correctIndex: 1, objasnjenje: "Bitka na Bedru (624.) — 313 muslimana porazilo je oko 1000 Kurejšija. Velika pobjeda.", tezina: 2 },
  { pitanje: "Koje je dijete Poslanika a.s. umrlo malo, a Poslanik je plakao?", opcije: ["Hasan", "Ibrahim", "Husejn", "Alija"], correctIndex: 1, objasnjenje: "Sin Ibrahim umro je u dojenju. Poslanik je plakao i rekao: 'Oko suze, srce tuguje, ali samo govorimo ono što je Allahu drago.'", tezina: 3 },
  { pitanje: "Koja je bitka u kojoj su muslimani prvo uspjeh, pa poraz zbog napuštanja položaja?", opcije: ["Bedr", "Uhud", "Hendek", "Hunejn"], correctIndex: 1, objasnjenje: "Bitka na Uhudu (625.) — strijelci su napustili položaj, pa su muslimani izgubili. Velika lekcija o poslušnosti.", tezina: 3 },
  { pitanje: "U kojoj godini je osvojena Mekka?", opcije: ["622.", "624.", "630.", "632."], correctIndex: 2, objasnjenje: "Osmoga godine po Hidžri (630.) Poslanik a.s. je s 10.000 ashaba mirnim putem ušao u Mekku.", tezina: 3 },
  { pitanje: "Kako se zove poslanik koji je dobio Tevrat?", opcije: ["Ibrahim", "Musa", "Isa", "Davud"], correctIndex: 1, objasnjenje: "Musa a.s. je dobio Tevrat (Toru) na brdu Tur." },
  { pitanje: "Kako se zove poslanik koji je sagradio Kabu sa svojim sinom Ismailom?", opcije: ["Adem", "Nuh", "Ibrahim", "Isa"], correctIndex: 2, objasnjenje: "Ibrahim a.s. i njegov sin Ismail a.s. su podigli temelje Kabe.", tezina: 2 },
  { pitanje: "Ko je 'Ulu-l-azm' poslanik kojem je dat Indžil?", opcije: ["Musa", "Isa", "Davud", "Sulejman"], correctIndex: 1, objasnjenje: "Isa a.s. (Isus) je dobio Indžil (Evanđelje) — vjerujemo u njega kao poslanika, ali ne kao Boga.", tezina: 2 },
  { pitanje: "Koliko ima 'Ulu-l-azm' poslanika (oni najveće odlučnosti)?", opcije: ["Tri", "Četiri", "Pet", "Šest"], correctIndex: 2, objasnjenje: "Pet 'Ulu-l-azm' poslanika: Nuh, Ibrahim, Musa, Isa i Muhammed a.s.", tezina: 3 },
];

// === BOSNA I NJENA BAŠTINA ======================================================
const BOSNA: SeedPitanje[] = [
  { pitanje: "Koji je glavni grad Bosne i Hercegovine?", opcije: ["Mostar", "Tuzla", "Sarajevo", "Banja Luka"], correctIndex: 2, objasnjenje: "Sarajevo je glavni grad BiH, sa starim dijelom 'Baščaršija' i Gazi Husrev-begovom džamijom." },
  { pitanje: "Kako se zove najpoznatija džamija u Sarajevu?", opcije: ["Careva džamija", "Gazi Husrev-begova džamija", "Begova džamija (oboje 1 i 2)", "Magribija"], correctIndex: 2, objasnjenje: "Gazi Husrev-begova džamija — narod je zove 'Begova džamija', sagrađena 1531. godine. Centar bošnjačke vjerske kulture." },
  { pitanje: "Ko je bio Gazi Husrev-beg?", opcije: ["Bosanski kralj", "Osmanski namjesnik i vakif Sarajeva", "Pjesnik", "Muallim"], correctIndex: 1, objasnjenje: "Gazi Husrev-beg (1480-1541) bio je sandžak-beg Bosanskog sandžaka. Sagradio je džamiju, medresu, hanikah, biblioteku — sve njegovi vakufi.", tezina: 2 },
  { pitanje: "Koja je najduža rijeka u Bosni i Hercegovini?", opcije: ["Drina", "Sava", "Bosna", "Neretva"], correctIndex: 1, objasnjenje: "Sava je najduža rijeka koja teče kroz BiH (granica sa Hrvatskom).", tezina: 2 },
  { pitanje: "Koja rijeka teče kroz Mostar i ispod čuvenog Starog mosta?", opcije: ["Bosna", "Drina", "Neretva", "Vrbas"], correctIndex: 2, objasnjenje: "Neretva — zelena planinska rijeka koja teče kroz Mostar i Hercegovinu." },
  { pitanje: "Koja rijeka razdvaja Bosnu od Srbije na istoku?", opcije: ["Sava", "Drina", "Bosna", "Una"], correctIndex: 1, objasnjenje: "Drina je istočna granica BiH prema Srbiji — proslavljena u djelima Iva Andrića." },
  { pitanje: "Koje je najveće bosansko jezero (vještačko)?", opcije: ["Plivsko jezero", "Buško jezero", "Boračko jezero", "Modrac"], correctIndex: 1, objasnjenje: "Buško jezero (Buško blato) u Hercegovini je najveće akumulaciono jezero.", tezina: 3 },
  { pitanje: "Koja je najviša planina u BiH?", opcije: ["Bjelašnica", "Maglić", "Vlašić", "Igman"], correctIndex: 1, objasnjenje: "Maglić (2386 m) na granici sa Crnom Gorom je najviši vrh BiH.", tezina: 2 },
  { pitanje: "Kako se zove najpoznatija medresa u BiH koja je još uvijek aktivna od 1537. godine?", opcije: ["Behrambegova medresa", "Kuršumlija medresa (Gazi Husrev-begova)", "Karađoz-begova medresa", "Elči-Ibrahim-pašina"], correctIndex: 1, objasnjenje: "Gazi Husrev-begova medresa (Kuršumlija) u Sarajevu — osnovana 1537., djeluje neprekidno do danas.", tezina: 2 },
  { pitanje: "Koje godine je Bosna i Hercegovina proglasila nezavisnost?", opcije: ["1991.", "1992.", "1993.", "1995."], correctIndex: 1, objasnjenje: "1. marta 1992. godine na referendumu je proglašena nezavisnost BiH.", tezina: 2 },
  { pitanje: "Ko je bio prvi predsjednik nezavisne BiH?", opcije: ["Haris Silajdžić", "Alija Izetbegović", "Bakir Izetbegović", "Sulejman Tihić"], correctIndex: 1, objasnjenje: "Alija Izetbegović — prvi predsjednik Predsjedništva BiH, autor 'Islamske deklaracije' i 'Bijega ka slobodi'." },
  { pitanje: "U kojem mjestu se desio genocid nad Bošnjacima jula 1995. godine?", opcije: ["Mostar", "Tuzla", "Srebrenica", "Goražde"], correctIndex: 2, objasnjenje: "U Srebrenici je u julu 1995. ubijeno preko 8000 bošnjačkih dječaka i muškaraca — priznato kao genocid.", tezina: 2 },
  { pitanje: "Koja je naša glavna bosanska ljiljanska zastava?", opcije: ["Plava sa bijelim ljiljanima", "Crvena sa polumjesecom", "Zelena sa zvijezdom", "Bijela sa ljiljanima"], correctIndex: 0, objasnjenje: "Tradicionalna bošnjačka zastava — plava (ili tirkizna) sa zlatnim ljiljanima.", tezina: 3 },
  { pitanje: "Kako se zove čuveni most u Mostaru, srušen 1993. i obnovljen 2004.?", opcije: ["Latinska ćuprija", "Stari most", "Most Mehmed-paše Sokolovića", "Šeher-ćehajina ćuprija"], correctIndex: 1, objasnjenje: "Stari most u Mostaru — sagradio ga Mimar Hajruddin 1566. godine, srušen u ratu, obnovljen 2004." },
  { pitanje: "Most Mehmed-paše Sokolovića na Drini je u kojem gradu?", opcije: ["Goražde", "Foča", "Višegrad", "Zvornik"], correctIndex: 2, objasnjenje: "Most na Drini u Višegradu — sagradio ga Mimar Sinan 1577. po naredbi velikog vezira Mehmed-paše Sokolovića. UNESCO baština." },
  { pitanje: "Koji bosanski pisac je dobio Nobelovu nagradu za književnost (1961.) za roman 'Na Drini ćuprija'?", opcije: ["Meša Selimović", "Ivo Andrić", "Miljenko Jergović", "Emir Kusturica"], correctIndex: 1, objasnjenje: "Ivo Andrić, rođen u Travniku — dobio Nobela za 'Na Drini ćuprija' 1961.", tezina: 2 },
  { pitanje: "Ko je autor romana 'Derviš i smrt' i 'Tvrđava'?", opcije: ["Ivo Andrić", "Meša Selimović", "Mak Dizdar", "Skender Kulenović"], correctIndex: 1, objasnjenje: "Meša Selimović, rođen u Tuzli — jedan od najvećih bosanskih književnika 20. stoljeća.", tezina: 2 },
  { pitanje: "Koji bošnjački pjesnik je napisao zbirku 'Kameni spavač' o stećcima?", opcije: ["Mak Dizdar", "Skender Kulenović", "Abdulah Sidran", "Tin Ujević"], correctIndex: 0, objasnjenje: "Mak Dizdar, u 'Kamenom spavaču' poetizira bosanske srednjovjekovne stećke.", tezina: 3 },
  { pitanje: "Koji su gradovi nakon Sarajeva najveći u BiH (po broju stanovnika)?", opcije: ["Banja Luka, Tuzla, Zenica", "Mostar, Brčko, Bihać", "Travnik, Goražde, Srebrenica", "Cazin, Sanski Most, Bugojno"], correctIndex: 0, objasnjenje: "Nakon Sarajeva najveći su Banja Luka, Tuzla i Zenica.", tezina: 2 },
  { pitanje: "Koji vrh planine Bjelašnice se koristio za Zimsku olimpijadu 1984.?", opcije: ["Maglić", "Bjelašnica", "Igman", "Sve gore navedeno (Sarajevo '84)"], correctIndex: 3, objasnjenje: "ZOI 1984. održane su u Sarajevu — Bjelašnica, Igman, Jahorina i Trebević su bile centri takmičenja.", tezina: 2 },
];

const ALL: Record<MedenaKategorija, SeedPitanje[]> = {
  sarti: SARTI,
  sure: SURE,
  dove: DOVE,
  namaz: NAMAZ,
  ponasanje: PONASANJE,
  halal_haram: HALAL_HARAM,
  historija: HISTORIJA,
  bosna: BOSNA,
};

export async function seedMedenaPitanja(): Promise<{
  total: number;
  perKategorija: Record<string, { upserted: number; existing: number }>;
}> {
  const perKategorija: Record<string, { upserted: number; existing: number }> = {};
  let total = 0;

  for (const kategorija of MEDENA_KATEGORIJE) {
    const lista = ALL[kategorija];
    let upserted = 0;
    let existing = 0;

    for (const p of lista) {
      // Provjeri postoji li već ovo pitanje (po tekstu) u toj kategoriji
      const found = await db
        .select({ id: igraPitanjaTable.id })
        .from(igraPitanjaTable)
        .where(
          and(
            eq(igraPitanjaTable.kategorija, kategorija),
            eq(igraPitanjaTable.pitanje, p.pitanje),
          ),
        )
        .limit(1);

      if (found.length > 0 && found[0]) {
        // Ažuriraj samo opcije/correctIndex/objasnjenje (zadržava admin izmjene id-a/aktivno polja)
        await db
          .update(igraPitanjaTable)
          .set({
            opcije: p.opcije,
            correctIndex: p.correctIndex,
            objasnjenje: p.objasnjenje,
            tezina: p.tezina ?? 1,
            updatedAt: new Date(),
          })
          .where(eq(igraPitanjaTable.id, found[0].id));
        existing++;
      } else {
        await db.insert(igraPitanjaTable).values({
          kategorija,
          pitanje: p.pitanje,
          opcije: p.opcije,
          correctIndex: p.correctIndex,
          objasnjenje: p.objasnjenje,
          tezina: p.tezina ?? 1,
          aktivno: true,
        });
        upserted++;
      }
    }

    perKategorija[kategorija] = { upserted, existing };
    total += lista.length;
  }

  return { total, perKategorija };
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  seedMedenaPitanja()
    .then((result) => {
      console.log(`✓ Medena staza seed gotov. Ukupno: ${result.total} pitanja.`);
      for (const [kat, { upserted, existing }] of Object.entries(result.perKategorija)) {
        console.log(`  ${kat}: ${upserted} novih + ${existing} ažuriranih`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("Greška pri seed-u:", err);
      process.exit(1);
    });
}
