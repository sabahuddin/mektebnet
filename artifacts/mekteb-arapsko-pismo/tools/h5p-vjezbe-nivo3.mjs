// H5P vježbe — Nivo 3, ahlak-blok (lekcije 53–68).
//
// Pitanja su izvedena iz teksta samih lekcija: iz ajeta i hadisa koje lekcija
// navodi, iz njenih podjela (tri vrste strpljivosti, uzroci ogovaranja) i iz
// njenih vlastitih priča i likova (Merjem, Haris), da vježba ostane u istom
// svijetu u kojem je dijete čitalo lekciju.
//
// Nazivlje po Pravilima Rijaseta (2022): amanet (ne emanet — glosar upućuje
// emanet → amanet), ashabi, Hidžra, Kurejšije, Iblis, Šam, hazreti Alija,
// Ebu Hurejre, Džennet. Riječi „sabr", „ihlas" (u značenju iskrenosti),
// „El-Emin" i „potvora" nisu u glosaru; zadržan je oblik iz same lekcije.

export const VJEZBE_N3 = [
  // ── 56. Prijateljstvo i drugarstvo ─────────────────────────────────
  {
    slug: "n3-prijateljstvo",
    tip: "set",
    naslov: "Prijateljstvo i drugarstvo",
    uvod: "Prizori iz svakodnevnog života. U svakom razmisli šta bi ti uradio i šta o tome kaže lekcija.",
    pitanja: [
      { tip: "mc",
        pitanje: "Amar se druži s društvom koje ga stalno nagovara da roditeljima ne kaže gdje ide. Kaže: „Ja se ne mijenjam, samo se družim s njima.“<br><br>Šta mu poručuje hadis o prodavcu mirisa i kovaču?",
        odgovori: [["Utjecaj druga je neizbježan — od kovača ćeš barem osjetiti neugodan miris, i kad ništa ne uzmeš", true],
                   ["Prijatelje treba birati prema tome koliko imaju novca", false],
                   ["S lošim drugom se smije družiti dok god mu ne vjeruješ", false],
                   ["Miris se mora kupiti da bi koristio", false]] },

      { tip: "mc",
        pitanje: "U priči iz lekcije, ošamareni prijatelj uvredu je zapisao u <strong>pijesak</strong>, a spašeni život uklesao u <strong>kamen</strong>.<br><br>Šta ta slika uči?",
        odgovori: [["Da uvrede treba pustiti da nestanu, a dobro trajno pamtiti", true],
                   ["Da je pijesak mekši od kamena", false],
                   ["Da treba voditi dnevnik o prijateljima", false],
                   ["Da prijateljstvo traje samo dok traje putovanje", false]] },

      { tip: "mc",
        pitanje: "Poslanik, a.s., je rekao: „Čovjek je na vjeri svog prijatelja, zato gledajte s kim se družite.“ (Ahmed)<br><br>Koji zaključak iz toga slijedi?",
        odgovori: [["Društvo utječe na našu vjeru, pa ga treba pažljivo birati", true],
                   ["Treba se družiti samo s rodbinom", false],
                   ["Prijatelji se ne smiju mijenjati kroz život", false],
                   ["Vjera se nasljeđuje od prijatelja umjesto od roditelja", false]] },

      { tip: "tf",
        pitanje: "Merjem je u dvorištu vidjela dječaka koji sjedi sam, prišla mu, podijelila jabuku i pozvala ga u igru. Lekcija takav postupak opisuje kao osobinu pravog prijatelja.",
        tacno: true },

      { tip: "tf",
        pitanje: "Prema lekciji, prijateljstvo se gradi prije svega na zajedničkoj zabavi i istim interesima.",
        tacno: false },

      { tip: "blanks",
        uputa: "Popuni praznine prema hadisu iz lekcije.",
        tekst: "Poslanik, a.s., dobrog i lošeg druga poredi s prodavcem *mirisa* i s *kovačem*." },

      { tip: "drag",
        uputa: "Šta prijatelj prenosi na prijatelja? Prevuci riječi.",
        tekst: "Dobar prijatelj prenosi znanje, lijepu *ćud*, iskren *savjet* i upozorava na *greške*. Loš prijatelj vodi u laž, prevaru i *nepravdu*.",
        ometaci: "*bogatstvo* *slavu*" },

      { tip: "mark",
        uputa: "Označi osobine na kojima se, prema lekciji, gradi pravo prijateljstvo.",
        tekst: "*iskrenost* zavist *praštanje* ogovaranje *povjerenje* oholost *pomaganje* prevara" },
    ],
  },

  // ── 59. Iskrenost i pravednost ─────────────────────────────────────
  {
    slug: "n3-iskrenost-pravednost",
    tip: "set",
    naslov: "Iskrenost i pravednost",
    uvod: "Iskrenost je temelj, a pravednost znači dati svakome njegovo pravo. Provjeri prepoznaješ li ih u životu.",
    pitanja: [
      { tip: "mc",
        pitanje: "Dvojica su očistila mekteb. Jedan je to uradio da ga muallim pohvali pred ostalima, drugi radi Allahovog zadovoljstva.<br><br>Šta o tome kaže hadis „Djela se vrednuju prema namjerama“?",
        odgovori: [["Djelo je izvana isto, ali vrijednost pred Allahom zavisi od namjere", true],
                   ["Oba djela su jednako nagrađena jer je posao isti", false],
                   ["Nagrada zavisi od toga ko je više očistio", false],
                   ["Pohvala muallima poništava svaku nagradu", false]] },

      { tip: "mc",
        pitanje: "Adnan bira ko će igrati za razred na takmičenju. Njegov najbolji drug je slabiji igrač od jednog drugog učenika.<br><br>Šta od njega traži pravednost?",
        odgovori: [["Da svakome da njegovo pravo, pa i kada mu je neko draži", true],
                   ["Da izabere druga, jer je prijateljstvo preče", false],
                   ["Da prepusti izbor nekom drugom", false],
                   ["Da izabere onoga ko se prvi prijavio", false]] },

      { tip: "mc",
        pitanje: "Prema lekciji, zašto samo iskreno učinjeno djelo biva primljeno?",
        odgovori: [["Zato što se djela vrednuju prema namjeri, a namjera mora biti radi Allahovog zadovoljstva", true],
                   ["Zato što je iskreno djelo obično i veće", false],
                   ["Zato što ga vide drugi ljudi", false],
                   ["Zato što se lakše zapamti", false]] },

      { tip: "tf",
        pitanje: "Prema hadisu, iskrenost vodi ka dobročinstvu, a dobročinstvo u Džennet.",
        tacno: true },

      { tip: "tf",
        pitanje: "Pravednost znači da prema onima koji su nam draži budemo blaži nego prema ostalima.",
        tacno: false },

      { tip: "blanks",
        uputa: "Popuni praznine.",
        tekst: "Iskrenost znači činiti dobro isključivo radi *Allahovog* zadovoljstva. Pravednost je poštivanje i uvažavanje tuđih *prava*." },

      { tip: "drag",
        uputa: "Dovrši hadis. Prevuci riječi na pravo mjesto.",
        tekst: "Iskrenost vodi ka *dobročinstvu*, a dobročinstvo u *Džennet*; laž vodi *bestidnosti*, a bestidnost u *vatru*.",
        ometaci: "*strpljivosti* *bogatstvu*" },

      { tip: "mark",
        uputa: "Označi ono što kvari iskrenost djela.",
        tekst: "*licemjerje* namjera *pretvaranje* ihlas *hvalisanje* dobročinstvo" },
    ],
  },

  // ── 60. Predanost i strpljivost ────────────────────────────────────
  {
    slug: "n3-strpljivost",
    tip: "set",
    naslov: "Predanost i strpljivost",
    uvod: "Strpljivost ima tri vrste. U svakoj situaciji prepoznaj koja je posrijedi.",
    pitanja: [
      { tip: "mc",
        pitanje: "Tarik već sedmicama trpi ružne riječi jednog druga iz razreda. Ne uzvraća mu i ne prestaje se družiti s ostalima.<br><br>Koja je to vrsta strpljivosti?",
        odgovori: [["Strpljivost u odnosu s ljudima", true],
                   ["Strpljivost u pokornosti", false],
                   ["Strpljivost u iskušenju", false],
                   ["To se ne ubraja u strpljivost", false]] },

      { tip: "mc",
        pitanje: "Nermina misli da su nevolje koje su je zadesile znak da je Allah, dž.š., ljut na nju.<br><br>Šta o tome uči lekcija?",
        odgovori: [["Da iskušenja nisu kazna, nego prilika da se pokaže koliko je vjera čvrsta", true],
                   ["Da nevolje pogađaju samo one koji griješe", false],
                   ["Da su iskušenja znak slabe vjere", false],
                   ["Da se iskušenja mogu izbjeći strpljivošću", false]] },

      { tip: "mc",
        pitanje: "Na pitanje koji ljudi će biti najviše iskušavani, Poslanik, a.s., je odgovorio da su to Allahovi poslanici, zatim najbolji, pa bolji.<br><br>Prema čemu se, dakle, mjeri iskušenje?",
        odgovori: [["Prema stepenu vjere — čija je vjera čvršća, više će imati iskušenja", true],
                   ["Prema godinama života", false],
                   ["Prema broju učinjenih grijeha", false],
                   ["Prema imovnom stanju", false]] },

      { tip: "mc",
        pitanje: "Koje tri radosti Allah, dž.š., obećava strpljivima u nedaćama?",
        odgovori: [["Bit će im oprošteno, Allah će im se smilovati i sigurno su na Pravom putu", true],
                   ["Bogatstvo, zdravlje i dug život", false],
                   ["Ugled među ljudima, uspjeh i mir", false],
                   ["Oprost, imetak i pobjeda nad neprijateljem", false]] },

      { tip: "tf",
        pitanje: "Prema hadisu, vjernik koji se povuče od ljudi da ne bi trpio njihove uvrede ima veću nagradu od onoga koji se druži i strpljivo podnosi.",
        tacno: false },

      { tip: "blanks",
        uputa: "Popuni praznine.",
        tekst: "Islam znači potpunu *predanost* Allahu, dž.š. Strpljivost je oružje kojim vjernik vodi borbu kroz životna *iskušenja*." },

      { tip: "drag",
        uputa: "Poveži opis s vrstom strpljivosti.",
        tekst: "Ustrajnost u ibadetu je strpljivost u *pokornosti*; podnošenje onoga što je Allah odredio je strpljivost u *iskušenju*; podnošenje uvreda od ljudi je strpljivost u *odnosu* s ljudima.",
        ometaci: "*nagradi* *znanju*" },

      { tip: "mark",
        uputa: "Označi ono što je Allah, dž.š., obećao strpljivima.",
        tekst: "*oprost* bogatstvo *milost* slava *uputa* pobjeda" },
    ],
  },

  // ── 61. Istinoljubivost i pouzdanost ───────────────────────────────
  {
    slug: "n3-istinoljubivost",
    tip: "set",
    naslov: "Istinoljubivost i pouzdanost",
    uvod: "Poslanik, a.s., bio je poznat kao El-Emin — povjerljivi. Provjeri prepoznaješ li pouzdanost u postupcima.",
    pitanja: [
      { tip: "mc",
        pitanje: "Kurejšije nisu vjerovale da je Muhammed, a.s., poslanik, a ipak su kod njega ostavljale svoje dragocjenosti na čuvanje.<br><br>Šta to pokazuje?",
        odgovori: [["Da su mu vjerovali zbog njegove pouzdanosti — bio je poznat kao El-Emin", true],
                   ["Da su ipak potajno vjerovali u poslanstvo", false],
                   ["Da u Mekki nije bilo drugog mjesta za čuvanje", false],
                   ["Da su mu plaćali za čuvanje", false]] },

      { tip: "mc",
        pitanje: "Kada mu je naređena Hidžra, Poslanik, a.s., ostavlja hazreti Aliju u Mekki.<br><br>Zašto?",
        odgovori: [["Da ljudima vrati stvari koje su mu ostavili na čuvanje", true],
                   ["Da čuva njegovu kuću dok se ne vrati", false],
                   ["Da povede porodicu za njim", false],
                   ["Da pregovara s Kurejšijama", false]] },

      { tip: "mc",
        pitanje: "Kenan je obećao drugu da neće nikome reći ono što mu je povjerio. Ipak je ispričao bratu, „jer to je samo brat“.<br><br>Šta je Kenan prekršio?",
        odgovori: [["Amanet — povjerenu obavezu koju je bio dužan čuvati", true],
                   ["Ništa, jer brat nije stranac", false],
                   ["Samo pravilo lijepog ponašanja, ne i vjerski propis", false],
                   ["Obećanje, ali ne i povjerenje", false]] },

      { tip: "tf",
        pitanje: "Prema hadisu, istinu treba reći i onda kada je gorka i kada je protiv nas samih.",
        tacno: true },

      { tip: "tf",
        pitanje: "Osobe koje krše data obećanja Poslanik, a.s., naziva licemjerima.",
        tacno: true },

      { tip: "blanks",
        uputa: "Popuni praznine.",
        tekst: "Poslanik, a.s., bio je u svome narodu poznat kao *El-Emin*, što znači *povjerljivi*." },

      { tip: "drag",
        uputa: "Prevuci riječi na pravo mjesto.",
        tekst: "Hatidža, r.a., povjeravala mu je trgovačku robu za daleki *Šam* upravo zbog njegove *pouzdanosti*.",
        ometaci: "*Jemen* *ljepote*" },

      { tip: "mark",
        uputa: "Označi postupke pouzdane osobe.",
        tekst: "Pouzdana osoba *vraća* posuđeno, *ispunjava* obećanje i *čuva* povjerenu tajnu, a nepouzdana izmišlja, iznevjeri i zaboravi." },
    ],
  },

  // ── 63. Samilost i praštanje ───────────────────────────────────────
  {
    slug: "n3-samilost-prastanje",
    tip: "set",
    naslov: "Samilost i praštanje",
    uvod: "Poslanik, a.s., rekao je da nije poslan da proklinje, nego kao milost. Provjeri šta to znači u svakodnevnom životu.",
    pitanja: [
      { tip: "mc",
        pitanje: "Ashabi su tražili od Poslanika, a.s., da prokune pleme Devs jer su odbili islam.<br><br>Šta je on učinio?",
        odgovori: [["Molio je Allaha da ih uputi i dovede — i oni su ubrzo primili islam", true],
                   ["Prokleo ih je i oni su uništeni", false],
                   ["Poslao im je vojsku", false],
                   ["Zabranio je ashabima da s njima trguju", false]] },

      { tip: "mc",
        pitanje: "Amir je drugu posudio bicikl, a ovaj ga je pokvario i izvinio se. Amir kaže: „Oprostit ću ti, ali ti više nikada neću ništa dati.“<br><br>Šta lekcija uči o vezi samilosti i praštanja?",
        odgovori: [["Onaj ko je istinski milostiv najčešće i oprosti uvredu ili štetu, bez zadržavanja ljutnje", true],
                   ["Praštanje znači da se šteta ne mora nadoknaditi", false],
                   ["Oprost vrijedi samo ako se izvinjenje ponovi tri puta", false],
                   ["Samilost se pokazuje samo prema onima koji nam nikada nisu naudili", false]] },

      { tip: "mc",
        pitanje: "Koja dva Allahova imena su prva spomenuta u Kur'anu, na koja nas svakodnevno podsjeća učenje Bismille?",
        odgovori: [["Er-Rahman — Milostivi i Er-Rahim — Samilosni", true],
                   ["El-Halik i El-Bari", false],
                   ["El-Melik i El-Kuddus", false],
                   ["El-Aziz i El-Hakim", false]] },

      { tip: "tf",
        pitanje: "Prema hadisu, Allahova milost stiže onoga ko se smiluje drugima na Zemlji.",
        tacno: true },

      { tip: "tf",
        pitanje: "Prema lekciji, samilost je najpreče iskazati prema strancima, a tek onda prema najbližima.",
        tacno: false },

      { tip: "blanks",
        uputa: "Dovrši hadis.",
        tekst: "Poslanik, a.s., je rekao: Ja nisam poslan da *proklinjem*, nego sam poslan kao *milost*." },

      { tip: "drag",
        uputa: "Prema kome je samilost najpreča? Prevuci riječi.",
        tekst: "Samilost je najpreče iskazati prema *roditeljima*, braći i sestrama, *rodbini*, prijateljima i *komšijama*.",
        ometaci: "*strancima* *takmacima*" },
    ],
  },

  // ── 64–66. Mahane srca i jezika ────────────────────────────────────
  {
    slug: "n3-mahane-srca",
    tip: "set",
    naslov: "Mahane srca i jezika",
    uvod: "Ogovaranje, oholost i škrtost. Prepoznaj ih u situacijama koje se dešavaju svaki dan.",
    pitanja: [
      { tip: "mc",
        pitanje: "U razredu pričaju o drugu koji muca. Jedna učenica kaže: „Ovo nije ogovaranje, jer je istina.“<br><br>Šta je Poslanik, a.s., odgovorio kada su ga ashabi to isto upitali?",
        odgovori: [["Ako pri njemu bude ono što spominješ — ogovorio si ga; ako ne bude — potvorio si ga", true],
                   ["Ako je istina, nije ogovaranje", false],
                   ["Ogovaranje je samo ono što se kaže pred većim brojem ljudi", false],
                   ["Ogovaranje se odnosi samo na odrasle", false]] },

      { tip: "mc",
        pitanje: "Kako Kur'an opisuje ogovaranje, u ajetu koji lekcija navodi?",
        odgovori: [["Kao jedenje mesa umrlog brata", true],
                   ["Kao gubljenje vremena", false],
                   ["Kao krađu tuđeg ugleda", false],
                   ["Kao zaboravljanje na namaz", false]] },

      { tip: "mc",
        pitanje: "Neko lijepo obučen kaže da voli da mu odjeća i obuća budu lijepe. Ashab je isto to rekao Poslaniku, a.s.<br><br>Je li to oholost?",
        odgovori: [["Nije — Allah je lijep i voli ljepotu; oholost je odbijanje istine i ponižavanje ljudi", true],
                   ["Jeste, jer svaka briga o izgledu vodi oholosti", false],
                   ["Jeste, ako je odjeća skupa", false],
                   ["Nije, jer se oholost odnosi samo na bogatstvo", false]] },

      { tip: "mc",
        pitanje: "Ko se, prema lekciji, prvi uzoholio i kojim riječima?",
        odgovori: [["Iblis — rekavši da je bolji jer je od vatre stvoren, a čovjek od ilovače", true],
                   ["Faraon — kada je tražio da mu se ljudi klanjaju", false],
                   ["Karun — kada se pohvalio svojim blagom", false],
                   ["Nemrud — kada se suprotstavio Ibrahimu, a.s.", false]] },

      { tip: "tf",
        pitanje: "Prema hadisu, učen škrtac je Allahu draži od neukog darežljivca.",
        tacno: false },

      { tip: "tf",
        pitanje: "Prema hadisu, neće ući u Džennet onaj u čijem srcu bude i koliko trun oholosti.",
        tacno: true },

      { tip: "blanks",
        uputa: "Popuni praznine.",
        tekst: "Škrtost proizlazi iz egoizma i straha od *siromaštva*. Šejtan nas plaši *neimaštinom* i navraća da budemo škrti." },

      { tip: "mark",
        uputa: "Označi uzroke ogovaranja koje navodi lekcija.",
        tekst: "*nepodnošenje* ljudi, hrabrost, *omalovažavanje* uspjeha, strpljivost, *zavidnost* na blagodatima, darežljivost" },
    ],
  },

  // ── brzo prepoznavanje ─────────────────────────────────────────────
  {
    slug: "n3-ahlak-brzo",
    tip: "scs",
    naslov: "Brzo razmisli — ahlak",
    uvod: "Deset kratkih situacija iz ahlak-lekcija. Prepoznaj o kojoj se osobini radi.",
    pitanja: [
      { pitanje: "Neko spomene svog druga po onome što ovaj ne voli, a to je istina. Šta je učinio?",
        odgovori: ["Ogovorio ga je", "Nije učinio ništa loše", "Potvorio ga je", "Posavjetovao ga je"] },
      { pitanje: "Neko spomene svog druga po onome što nije istina. Šta je učinio?",
        odgovori: ["Potvorio ga je", "Ogovorio ga je", "Pohvalio ga je", "Nije učinio ništa loše"] },
      { pitanje: "Ustrajnost u klanjanju namaza i kad je teško — koja vrsta strpljivosti?",
        odgovori: ["Strpljivost u pokornosti", "Strpljivost u iskušenju", "Strpljivost u odnosu s ljudima", "To nije strpljivost"] },
      { pitanje: "Strpljivo podnošenje bolesti koju je Allah odredio — koja vrsta strpljivosti?",
        odgovori: ["Strpljivost u iskušenju", "Strpljivost u pokornosti", "Strpljivost u odnosu s ljudima", "To nije strpljivost"] },
      { pitanje: "Prema hadisu, čime se mjeri koliko će čovjek biti iskušavan?",
        odgovori: ["Stepenom njegove vjere", "Brojem godina", "Brojem grijeha", "Visinom imetka"] },
      { pitanje: "Odbijanje istine i ponižavanje ljudi — kako se to zove?",
        odgovori: ["Oholost", "Škrtost", "Zavidnost", "Ogovaranje"] },
      { pitanje: "Čuvanje povjerene stvari i ispunjavanje dogovorenog naziva se:",
        odgovori: ["Amanet", "Sadaka", "Ihlas", "Sabr"] },
      { pitanje: "Poslanik, a.s., poredi dobrog i lošeg druga s:",
        odgovori: ["Prodavcem mirisa i kovačem", "Pekarom i mesarom", "Kišom i sušom", "Danom i noći"] },
      { pitanje: "Kojim nadimkom je Poslanik, a.s., bio poznat prije poslanstva?",
        odgovori: ["El-Emin — povjerljivi", "El-Halim — blagi", "El-Kerim — plemeniti", "Es-Sadik — istiniti"] },
      { pitanje: "Davanje svakome njegovog prava, i onda kada nam neko nije drag, naziva se:",
        odgovori: ["Pravednost", "Samilost", "Darežljivost", "Strpljivost"] },
    ],
  },

  // ── kartice za ponavljanje ─────────────────────────────────────────
  {
    slug: "n3-ahlak-kartice",
    tip: "kartice",
    naslov: "Kartice za ponavljanje — ahlak",
    uvod: "Pročitaj pitanje, razmisli, pa okreni karticu. Ono što ne znaš vraća se češće.",
    kartice: [
      { lice: "Drug ti kaže: „Nije ogovaranje ako je istina.“ Kako mu odgovaraš na osnovu hadisa?",
        nalicje: "Poslanik, a.s., je rekao: ako pri njemu bude ono što spominješ — ogovorio si ga; a ako ne bude — potvorio si ga. (Muslim)" },
      { lice: "Koje su tri vrste strpljivosti?",
        nalicje: "Strpljivost u pokornosti (ustrajnost u ibadetu), strpljivost u iskušenju (podnošenje Allahove odredbe) i strpljivost u odnosu s ljudima (podnošenje uvreda)." },
      { lice: "Koje tri radosti Allah obećava strpljivima?",
        nalicje: "Bit će im oprošteno, Allah će im se smilovati i sigurno su na Pravom putu." },
      { lice: "Šta je oholost, prema hadisu?",
        nalicje: "Odbijanje istine i ponižavanje ljudi. Briga o lijepoj odjeći nije oholost — Allah je lijep i voli ljepotu." },
      { lice: "Zašto je Poslanik, a.s., pri Hidžri ostavio hazreti Aliju u Mekki?",
        nalicje: "Da ljudima vrati stvari koje su mu bili ostavili na čuvanje — iako su ga isti ti ljudi progonili." },
      { lice: "Šta znači da se djela vrednuju prema namjerama?",
        nalicje: "Isto djelo može biti primljeno ili odbijeno, ovisno o tome je li učinjeno radi Allahovog zadovoljstva ili radi pohvale ljudi. (Buhari)" },
      { lice: "S čim Poslanik, a.s., poredi dobrog i lošeg druga?",
        nalicje: "S prodavcem mirisa i kovačem: od prvog ćeš barem osjetiti lijep miris, od drugog ćeš barem osjetiti dim ili ti izgorjeti odjeća. (Buhari)" },
      { lice: "Šta je pravednost?",
        nalicje: "Poštivanje i uvažavanje tuđih prava — dati svakome ono što mu pripada, pa i kada nam ta osoba nije draga." },
      { lice: "Iz čega proizlazi škrtost i čime nas šejtan na nju navraća?",
        nalicje: "Iz egoizma i straha od siromaštva. Šejtan nas plaši neimaštinom i navraća da budemo škrti. (El-Bekare, 268)" },
      { lice: "Šta je amanet?",
        nalicje: "Povjerena stvar ili obaveza koju smo dužni sačuvati i ispuniti. Ko ga ne čuva, prema hadisu, nema potpune vjere." },
    ],
  },

  // ── pojmovi ────────────────────────────────────────────────────────
  // Ranije Flashcards, zamijenjeno iz istog razloga kao i u Nivou 1:
  // upisivanje odgovora provjerava tipkanje, a ne znanje.
  {
    slug: "n3-ahlak-pojmovi",
    tip: "scs",
    naslov: "Prepoznaj pojam — ahlak",
    uvod: "Pročitaj opis i odaberi pojam.",
    pitanja: [
      { pitanje: "Spominjanje brata po onome što on ne voli, a što je istina.",
        odgovori: ["Ogovaranje", "Potvora", "Savjet", "Opomena"] },
      { pitanje: "Spominjanje brata po onome što nije istina.",
        odgovori: ["Potvora", "Ogovaranje", "Šala", "Kritika"] },
      { pitanje: "Odbijanje istine i ponižavanje ljudi.",
        odgovori: ["Oholost", "Škrtost", "Zavidnost", "Srdžba"] },
      { pitanje: "Zadržavanje imetka za sebe i uskraćivanje drugima.",
        odgovori: ["Škrtost", "Štednja", "Zavidnost", "Oprez"] },
      { pitanje: "Povjerena stvar ili obaveza koju smo dužni sačuvati.",
        odgovori: ["Amanet", "Sadaka", "Zekat", "Nijet"] },
      { pitanje: "Poštivanje i uvažavanje tuđih prava.",
        odgovori: ["Pravednost", "Darežljivost", "Strpljivost", "Samilost"] },
      { pitanje: "Dostojanstveno podnošenje nedaća, oružje vjernika.",
        odgovori: ["Strpljivost", "Šutnja", "Skromnost", "Ustrajnost"] },
      { pitanje: "Nadimak po kojem je Poslanik, a.s., bio poznat prije poslanstva.",
        odgovori: ["El-Emin", "Es-Sidik", "El-Halim", "El-Kerim"] },
      { pitanje: "Osjećaj koji nas navodi da oprostimo uvredu i budemo blagi.",
        odgovori: ["Samilost", "Strpljivost", "Pravednost", "Skromnost"] },
      { pitanje: "Činjenje dobra isključivo radi Allahovog zadovoljstva.",
        odgovori: ["Iskrenost", "Darežljivost", "Pobožnost", "Ustrajnost"] },
    ],
  },
];
