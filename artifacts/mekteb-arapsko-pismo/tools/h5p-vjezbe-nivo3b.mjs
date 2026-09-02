// H5P vježbe — Nivo 3, drugi paket.
// Pokriva: odnosi s ljudima (45-48, 53-55, 57, 62), štetne navike (69-77),
// zdravlje i okolina (50), te historija islama (83-89, 97, 98).
//
// Naglasak je na asocijacijama i situacijama: „šta je zajedničko“, „šta ne
// pripada nizu“, „prepoznaj obrazac“ i prizori iz svakodnevnog života.
// Činjenice su iz teksta samih lekcija — ajeti s izvorom, hadisi s izvorom,
// godine i imena onako kako ih lekcija navodi.
//
// Nazivlje po Pravilima Rijaseta: hazreti Hava, Ebu Bekr, Es-Sidik, Aiša r.a.,
// Jesrib, Akaba, Bedr, Medina, Mekka, hulefair-rašidin.

export const VJEZBE_N3B = [
  // ── odnosi: roditelji, rodbina, stariji ────────────────────────────
  {
    slug: "n3-roditelji-i-stariji",
    tip: "set",
    naslov: "Roditelji, rodbina i stariji",
    uvod: "Prizori iz kuće i komšiluka. U svakom prepoznaj šta se od tebe traži.",
    pitanja: [
      { tip: "mc",
        pitanje: "Nedžad je zauzet i majka ga je zamolila da joj pomogne. Odgovorio je: „Sad ću“ — i nije došao. Kasnije kaže da nije rekao ne, pa nije ni pogriješio.<br><br>Šta lekcija uči o dobročinstvu prema roditeljima?",
        odgovori: [["Na dobročinstvo roditelja treba uzvratiti još većim dobročinstvom, a ne najmanjim mogućim", true],
                   ["Dovoljno je da nije odbio naglas", false],
                   ["Obaveza vrijedi tek kada dijete postane punoljetno", false],
                   ["Poslušnost se odnosi samo na oca", false]] },

      { tip: "mc",
        pitanje: "Poslanik, a.s., je rekao: „Ko ne bude milostiv prema mlađima i ne bude poštovao starije i priznavao pravo učenih — ne pripada nama.“ (Buhari)<br><br>Koliko obaveza taj hadis postavlja?",
        odgovori: [["Tri — milost prema mlađima, poštovanje starijih i priznavanje prava učenih", true],
                   ["Jednu — poštovanje starijih", false],
                   ["Dvije — poštovanje starijih i učenih", false],
                   ["Nijednu, to je samo savjet", false]] },

      { tip: "mc",
        pitanje: "<strong>Asocijacija.</strong> Šta povezuje ove tri pojave: djeca postaju srdita, mlađi se neuljudno suprotstavljaju starijima, smanjuje se broj plemenitih ljudi?",
        odgovori: [["Poslanik, a.s., ih je naveo kao male predznake Sudnjeg dana", true],
                   ["To su uzroci siromaštva u društvu", false],
                   ["To su posljedice loše ishrane", false],
                   ["To su znakovi da se približava ramazan", false]] },

      { tip: "tf",
        pitanje: "Ajet iz sure Lukman posebno spominje majčin trud — kako ga nosi dok njeno zdravlje trpi i kako ga doji dvije godine.",
        tacno: true },

      { tip: "tf",
        pitanje: "Prema lekciji, obaveza poštovanja starijih vrijedila je samo u vrijeme ashaba, a danas su prilike drukčije.",
        tacno: false },

      { tip: "blanks",
        uputa: "Popuni praznine.",
        tekst: "Ajet u suri Lukman naređuje da budemo poslušni *roditeljima* i da budemo zahvalni prvo *Allahu*, a zatim njima." },

      { tip: "mark",
        uputa: "Označi ono što, prema hadisu, tri puta traži jedna te ista rečenica.",
        tekst: "Biti *milostiv* prema mlađima, biti bogat, *poštovati* starije, biti poznat, *priznavati* pravo učenih" },
    ],
  },

  // ── odnosi: komšije, dobrota, lijepa riječ ─────────────────────────
  {
    slug: "n3-komsije-i-dobrota",
    tip: "set",
    naslov: "Komšije, dobrota i lijepa riječ",
    uvod: "Šest prava koje musliman ima kod muslimana, i šta to znači u tvojoj ulici.",
    pitanja: [
      { tip: "mc",
        pitanje: "<strong>Asocijacija.</strong> Nazvati selam, odazvati se pozivu, posavjetovati kad zatraži savjet, reći jerhamukellah kad kihne, obići ga kad se razboli, otpratiti mu dženazu.<br><br>Šta je ovo?",
        odgovori: [["Šest prava koje musliman ima kod drugog muslimana", true],
                   ["Šest uvjeta za valjan namaz", false],
                   ["Šest imanskih šarta", false],
                   ["Šest dužnosti prema roditeljima", false]] },

      { tip: "mc",
        pitanje: "Ajet iz sure En-Nisa nabraja redom: roditelji, rođaci, siročad, siromasi, komšije bližnje, komšije daljnje, drugovi.<br><br>Šta taj redoslijed pokazuje?",
        odgovori: [["Da se dobročinstvo širi u krugovima — od najbližih prema daljnjima", true],
                   ["Da su komšije važnije od rodbine", false],
                   ["Da se dobročinstvo čini samo onima koji su nabrojani", false],
                   ["Da se siročad spominje posljednja", false]] },

      { tip: "mc",
        pitanje: "Kenan i komšija njegovih godina se ne slažu. Kenan kaže: „Ja s njim nemam ništa, samo živimo u istoj ulici.“<br><br>Šta lekcija kaže o komšijama vršnjacima?",
        odgovori: [["S njima se treba igrati, družiti i paziti ih", true],
                   ["Dovoljno je da se ne svađaju", false],
                   ["Obaveza se odnosi samo na starije komšije", false],
                   ["Komšiluk je stvar navike, a ne vjere", false]] },

      { tip: "tf",
        pitanje: "Prema hadisu, najbolji od svih komšija je onaj koji se najljepše odnosi prema svom komšiji.",
        tacno: true },

      { tip: "tf",
        pitanje: "Lijep odnos prema komšijama je stvar lijepog odgoja, ali nema veze s potvrđivanjem vjere.",
        tacno: false },

      { tip: "blanks",
        uputa: "Popuni praznine.",
        tekst: "Ajet u suri En-Nisa spominje i komšije *bližnje* i komšije *daljnje*, što znači da obaveza ne prestaje na prvom susjedu." },

      { tip: "drag",
        uputa: "Koje pravo odgovara kojoj prilici? Prevuci riječi.",
        tekst: "Kada ga sretneš — nazovi mu *selam*. Kada kihne — reci mu *jerhamukellah*. Kada se razboli — *obiđi* ga. Kada zatraži savjet — *posavjetuj* ga.",
        ometaci: "*počasti* *ispitaj*" },
    ],
  },

  // ── porodica, brak, odijevanje ─────────────────────────────────────
  {
    slug: "n3-porodica",
    tip: "set",
    naslov: "Porodica i izbor supružnika",
    uvod: "Porodica je temelj društva. Provjeri šta lekcija o njoj uči.",
    pitanja: [
      { tip: "mc",
        pitanje: "Koja je bila prva porodica na dunjaluku?",
        odgovori: [["Adem, a.s., i hazreti Hava, te njihova djeca", true],
                   ["Nuh, a.s., i njegova porodica", false],
                   ["Ibrahim, a.s., i njegova porodica", false],
                   ["Porodica poslanika Muhammeda, a.s.", false]] },

      { tip: "mc",
        pitanje: "Ajet iz sure Er-Rum navodi da je Allah, dž.š., između supružnika uspostavio dvije stvari.<br><br>Koje?",
        odgovori: [["Ljubav i samilost", true],
                   ["Bogatstvo i ugled", false],
                   ["Poslušnost i strah", false],
                   ["Znanje i mudrost", false]] },

      { tip: "mc",
        pitanje: "Učeni ljudi su rekli da je porodica temelj na kojem počiva kompletno društvo.<br><br>Kako islam, prema lekciji, gleda na porodicu?",
        odgovori: [["Kao na osnovnu ćeliju iz koje stasavaju najbolji pojedinci", true],
                   ["Kao na privatnu stvar u koju se vjera ne miješa", false],
                   ["Kao na ekonomsku zajednicu", false],
                   ["Kao na običaj naslijeđen od predaka", false]] },

      { tip: "tf",
        pitanje: "Prema lekciji, jedan od najbitnijih preduvjeta za zdravu porodicu jeste izbor supružnika.",
        tacno: true },

      { tip: "blanks",
        uputa: "Popuni praznine.",
        tekst: "Ajet u suri Er-Rum kaže da je Allah stvorio supružnike da se uz njih *smirite*, i da je između njih uspostavio ljubav i *samilost*." },
    ],
  },

  // ── štetne navike I ────────────────────────────────────────────────
  {
    slug: "n3-stetne-navike",
    tip: "set",
    naslov: "Duhan, alkohol i droga",
    uvod: "Zašto je nešto zabranjeno i onda kada se ne spominje poimenice u Kur'anu.",
    pitanja: [
      { tip: "mc",
        pitanje: "Neko kaže: „Duhan se nigdje u Kur'anu ne spominje, znači nije zabranjen.“<br><br>Kako lekcija odgovara na to?",
        odgovori: [["Tačno je da nema imenične zabrane, ali se zabrana izvodi iz štete koju duhan nanosi", true],
                   ["Duhan se ipak spominje, samo drugim imenom", false],
                   ["Duhan nije zabranjen, samo je pokuđen", false],
                   ["Zabrana važi samo za maloljetne", false]] },

      { tip: "mc",
        pitanje: "<strong>Asocijacija.</strong> Ajet iz sure El-Bekare kaže: „...i sami sebe u propast ne dovodite...“<br><br>Zašto lekcija baš tim ajetom otvara temu duhana?",
        odgovori: [["Jer islam zabranjuje sve što šteti ljudskom organizmu, pa i ono što nije poimenice spomenuto", true],
                   ["Jer se ajet odnosi na trošenje novca", false],
                   ["Jer je ajet objavljen povodom duhana", false],
                   ["Jer govori o ratu, a duhan je rat protiv sebe", false]] },

      { tip: "mc",
        pitanje: "Prema lekciji, medicina potvrđuje da duhan izaziva bolest ovisnosti.<br><br>Zašto je i sama ovisnost problem u islamu?",
        odgovori: [["Zato što je ovisnost u suprotnosti s islamskim principima — čovjek gubi vlast nad sobom", true],
                   ["Zato što ovisnost skraćuje vrijeme za rad", false],
                   ["Zato što ovisnost košta novca", false],
                   ["Ovisnost sama po sebi nije problem", false]] },

      { tip: "tf",
        pitanje: "Prema lekciji, pušač šteti samo sebi, a ne i onima oko sebe.",
        tacno: false },

      { tip: "mark",
        uputa: "Označi posljedice duhana koje lekcija navodi.",
        tekst: "*skraćuje* životni vijek, jača imunitet, *ubrzano* starenje, poboljšava sluh, *bolesti* srca, čisti pluća" },
    ],
  },

  // ── štetne navike II: kocka i internet ─────────────────────────────
  {
    slug: "n3-kocka-i-internet",
    tip: "set",
    naslov: "Kladionice i ovisnost o internetu",
    uvod: "Dvije navike koje izgledaju bezazleno, a lekcija pokazuje šta odnose.",
    pitanja: [
      { tip: "mc",
        pitanje: "<strong>Asocijacija.</strong> Ajet iz sure El-Maide u istom nizu spominje: vino, kocku, kumire i strelice za gatanje.<br><br>Šta im je zajedničko, prema tom ajetu?",
        odgovori: [["Sve su odvratne stvari i šejtanovo djelo, i toga se treba kloniti", true],
                   ["Sve su bile običaj samo u predislamskoj Arabiji", false],
                   ["Sve se odnose na trošenje imetka", false],
                   ["Sve su dozvoljene u maloj mjeri", false]] },

      { tip: "mc",
        pitanje: "Emir kaže: „Uplatim mali tiket, to nikome ne šteti.“<br><br>Koji razlog zabrane kocke iz lekcije najviše pogađa taj stav?",
        odgovori: [["Kockar živi u iluziji da će lahko i bez truda doći do bogatstva", true],
                   ["Kocka je zabranjena samo ako je iznos velik", false],
                   ["Kocka je dozvoljena ako se dobitak podijeli", false],
                   ["Kocka šteti samo onome ko izgubi", false]] },

      { tip: "mc",
        pitanje: "Poslanik, a.s., je rekao: „Iskoristi pet stvari prije nego dođe drugih pet: mladost prije starosti, zdravlje prije bolesti, bogatstvo prije siromaštva, slobodno vrijeme prije zauzetosti i život prije smrti.“ (El-Hakim)<br><br>Zašto lekcija o internetu počinje baš tim hadisom?",
        odgovori: [["Jer se ovisnošću troši upravo ono što je nabrojano — mladost, zdravlje i slobodno vrijeme", true],
                   ["Jer hadis zabranjuje korištenje interneta", false],
                   ["Jer govori o zaradi na internetu", false],
                   ["Jer se odnosi samo na starije ljude", false]] },

      { tip: "tf",
        pitanje: "Prema lekciji, ovisnost o internetu narušava zdravlje i uzrokuje poteškoće u društvenom funkcioniranju.",
        tacno: true },

      { tip: "tf",
        pitanje: "Kocka, prema lekciji, odvraća od namaza i od spominjanja Allaha, dž.š.",
        tacno: true },

      { tip: "blanks",
        uputa: "Popuni praznine.",
        tekst: "Lekcija navodi da kocka uzrokuje *neprijateljstvo* i mržnju među ljudima, te da kockari prisvajaju tuđu *imovinu*." },

      { tip: "mark",
        uputa: "Označi ono što ajet iz sure El-Maide nabraja u istom nizu.",
        tekst: "*vino* hljeb *kocka* voda *kumiri* zlato *strelice* za gatanje" },
    ],
  },

  // ── zdravlje i okolina ─────────────────────────────────────────────
  {
    slug: "n3-zdravlje-i-okolina",
    tip: "set",
    naslov: "Zdravlje i čuvanje okoline",
    uvod: "Tijelo i priroda su nam dati na čuvanje, ne na trošenje.",
    pitanja: [
      { tip: "mc",
        pitanje: "Amina baca smeće u rijeku govoreći da je to kaplja u moru.<br><br>Kojim hadisom lekcija o ekologiji obrazlaže brigu o okolini?",
        odgovori: [["„Zaista je Allah lijep, i voli ljepotu.“ (Muslim)", true],
                   ["„Čistoća je pola vjere.“", false],
                   ["„Djela se vrednuju prema namjerama.“", false],
                   ["„Nema vjere onaj ko nema amaneta.“", false]] },

      { tip: "mc",
        pitanje: "<strong>Asocijacija.</strong> Sunce koje daje toplotu i svjetlost, drveće, planine, ravnice, biljni i životinjski svijet.<br><br>Kako lekcija opisuje taj niz?",
        odgovori: [["Kao ljepote koje su nam date na korištenje, ali i na čuvanje", true],
                   ["Kao prirodne resurse kojima slobodno raspolažemo", false],
                   ["Kao dokaz da je Zemlja stara", false],
                   ["Kao teme za nastavu biologije", false]] },

      { tip: "tf",
        pitanje: "Prema lekciji, okolinu samo koristimo i u njoj živimo, ali za njeno stanje nismo odgovorni.",
        tacno: false },

      { tip: "blanks",
        uputa: "Popuni praznine.",
        tekst: "Ljepota okoline koja nas okružuje ogleda se kroz našu ekološku *svijest*, a Allah je, prema hadisu, lijep i voli *ljepotu*." },
    ],
  },

  // ── historija: Hidžra i Bedr ───────────────────────────────────────
  {
    slug: "n3-hidzra-i-bedr",
    tip: "set",
    naslov: "Hidžra i Bitka na Bedru",
    uvod: "Dva događaja koja su odredila sudbinu prve muslimanske zajednice.",
    pitanja: [
      { tip: "mc",
        pitanje: "Ajet iz sure Et-Tevbe opisuje dvojicu u pećini i riječi: „Ne brini se, Allah je s nama!“<br><br>Na koji događaj se to odnosi?",
        odgovori: [["Na Hidžru — Poslanikov, a.s., odlazak iz Mekke u Medinu", true],
                   ["Na Bitku na Bedru", false],
                   ["Na Isru i Miradž", false],
                   ["Na Oproštajni hadž", false]] },

      { tip: "mc",
        pitanje: "Kako se Medina zvala prije islama?",
        odgovori: [["Jesrib", true], ["Taif", false], ["Hajber", false], ["Akaba", false]] },

      { tip: "mc",
        pitanje: "Šta je bio neposredni povod Bitke na Bedru?",
        odgovori: [["Mekanski idolopoklonici su opljačkali imovinu muslimana i prodali je u Siriji da opreme vojsku", true],
                   ["Muslimani su napali karavan bez razloga", false],
                   ["Spor oko vode u Medini", false],
                   ["Kršenje ugovora o hadžu", false]] },

      { tip: "tf",
        pitanje: "Ajet iz sure Alu Imran naglašava da su muslimani na Bedru bili malobrojni i da ih je Allah pomogao.",
        tacno: true },

      { tip: "blanks",
        uputa: "Popuni praznine.",
        tekst: "Jedanaeste godine poslanstva Muhammed, a.s., susreo je kod *Akabe* ljude iz Jesriba, koji će kasnije postati *Medina*." },
    ],
  },

  // ── historija: halife ──────────────────────────────────────────────
  {
    slug: "n3-halife",
    tip: "set",
    naslov: "Pravedne halife",
    uvod: "Četverica koje su muslimani sami izabrali. Prepoznaj ih po onome što ih razlikuje.",
    pitanja: [
      { tip: "mc",
        pitanje: "Kako se jednim imenom zovu četverica pravednih halifa?",
        odgovori: [["Hulefair-rašidin", true], ["Ashabi-kiram", false],
                   ["Tabiini", false], ["Muhadžiri", false]] },

      { tip: "mc",
        pitanje: "<strong>Asocijacija.</strong> Prozvan Es-Sidik, otac Aiše, r.a., saputnik u Hidžri, prvi izabrani halifa, vladao od 632. do 634. godine.<br><br>O kome je riječ?",
        odgovori: [["Ebu Bekr, r.a.", true], ["Omer, r.a.", false],
                   ["Osman, r.a.", false], ["Alija, r.a.", false]] },

      { tip: "mc",
        pitanje: "Šta znači nadimak Es-Sidik koji je Poslanik, a.s., dao Ebu Bekru, r.a.?",
        odgovori: [["Iskreni", true], ["Hrabri", false], ["Učeni", false], ["Darežljivi", false]] },

      { tip: "tf",
        pitanje: "Pravedne halife su na tu funkciju došle nasljeđivanjem, kao kraljevi.",
        tacno: false },

      { tip: "blanks",
        uputa: "Popuni praznine.",
        tekst: "Ebu Bekr, r.a., je čitav svoj *imetak* u više navrata davao za potrebe zajednice, a Poslaniku, a.s., bio je zamjena u predvođenju *namaza*." },
    ],
  },

  // ── čiste asocijacije ──────────────────────────────────────────────
  {
    slug: "n3-asocijacije",
    tip: "scs",
    naslov: "Asocijacije — Nivo 3",
    uvod: "U svakom nizu pronađi ono što ga povezuje. Bez učenja napamet — samo razmisli.",
    pitanja: [
      { pitanje: "Vino · kocka · kumiri · strelice za gatanje. Šta ih povezuje?",
        odgovori: ["Ajet ih naziva šejtanovim djelom", "Sve su bile trgovačka roba", "Sve su dozvoljene u maloj mjeri", "Sve se spominju u suri El-Fatiha"] },
      { pitanje: "Mladost · zdravlje · bogatstvo · slobodno vrijeme · život. Šta ih povezuje?",
        odgovori: ["Pet stvari koje treba iskoristiti prije drugih pet", "Pet islamskih šarta", "Pet uvjeta za hadž", "Pet dnevnih namaza"] },
      { pitanje: "Selam · odazivanje · savjet · jerhamukellah · posjeta bolesnom · dženaza. Šta je to?",
        odgovori: ["Prava muslimana kod muslimana", "Namaski ruknovi", "Dužnosti prema roditeljima", "Uvjeti za džemat"] },
      { pitanje: "Roditelji · rođaci · siročad · siromasi · komšije · drugovi. Odakle taj niz?",
        odgovori: ["Iz ajeta o dobročinstvu, sura En-Nisa", "Iz hadisa o komšiluku", "Iz propisa o zekatu", "Iz opisa Dženneta"] },
      { pitanje: "Pećina · dvojica · „Allah je s nama“ · Jesrib. Na šta upućuje?",
        odgovori: ["Na Hidžru", "Na Bitku na Bedru", "Na Isru i Miradž", "Na Oproštajni hadž"] },
      { pitanje: "Es-Sidik · otac Aiše, r.a. · saputnik u Hidžri · 632–634.",
        odgovori: ["Ebu Bekr, r.a.", "Omer, r.a.", "Osman, r.a.", "Alija, r.a."] },
      { pitanje: "Ljubav · samilost · smiraj. Iz kojeg ajeta i o čemu?",
        odgovori: ["Er-Rum — o supružnicima i porodici", "El-Bekare — o postu", "En-Nisa — o siročadi", "El-Maide — o hrani"] },
      { pitanje: "Skraćuje životni vijek · ubrzano starenje · bolesti srca · loša higijena usta.",
        odgovori: ["Posljedice duhana", "Posljedice posta", "Posljedice nesanice", "Posljedice putovanja"] },
      { pitanje: "Milost prema mlađima · poštovanje starijih · priznavanje prava učenih.",
        odgovori: ["Tri obaveze iz jednog hadisa", "Tri uvjeta za imama", "Tri vrste strpljivosti", "Tri islamska šarta"] },
      { pitanje: "Adem, a.s. · hazreti Hava · njihova djeca.",
        odgovori: ["Prva porodica na dunjaluku", "Prvi muslimani u Medini", "Prvi koji su klanjali namaz", "Prvi stanovnici Mekke"] },
    ],
  },
];
