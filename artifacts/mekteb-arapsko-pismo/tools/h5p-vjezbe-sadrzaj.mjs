// Sadržaj H5P vježbi za Nivo 1.
//
// Pitanja su situacijska: dijete se stavlja u prizor koji poznaje (mekteb,
// kuća, škola, put) i mora primijeniti pravilo, a ne izbrojati stavke.
// Netačni odgovori nisu nasumični — svaki predstavlja stvarnu zabludu
// (npr. zamjena imanskog i islamskog šarta), pa pogrešan izbor muallimu
// kaže gdje je rupa u razumijevanju.
//
// Činjenice su izvedene iz teksta samih lekcija (Imanski, Islamski,
// Namaski i Dinski šarti). Nazivlje po Pravilima Rijaseta (2022):
// nijet, kibla, ruku', kijam, kiraet, sedžda, tekbir, abdest, gusul,
// šehadet, meleci, šart/šartovi.
//
// Tipovi: mc, tf, blanks, drag, mark  (unutar Question Seta)
//         scs (Single Choice Set), kartice (Dialog Cards), flash (Flashcards)

export const VJEZBE = [
  // ─────────────────────────────────────────────────────────────
  {
    slug: "imanski-sarti",
    tip: "set",
    naslov: "Imanski šarti — u što vjerujem",
    uvod: "Nema pitanja tipa „koliko ima“. Svako pitanje je situacija iz života — razmisli koje vjerovanje stoji iza postupka.",
    pitanja: [
      { tip: "mc",
        pitanje: "Merjema je dobila lošu ocjenu iako je učila cijelu sedmicu. Prvo se naljutila, a onda se smirila jer se sjetila da i ono što nam se ne sviđa dolazi Allahovom voljom i da u tome ima mudrosti.<br><br>Koji imanski šart joj je pomogao da se smiri?",
        odgovori: [["Šesti — da se sve događa Allahovom voljom i određenjem", true],
                   ["Treći — vjerovanje u Allahove knjige", false],
                   ["Četvrti — vjerovanje u Allahove poslanike", false],
                   ["Drugi — vjerovanje u Allahove meleke", false]] },

      { tip: "mc",
        pitanje: "Šta je zajedničko Tevratu, Zeburu, Indžilu i Kur'anu?",
        odgovori: [["Sve su to Allahove objave — to je treći imanski šart", true],
                   ["Sve su objavljene Muhammedu, a.s.", false],
                   ["Sve su napisane na arapskom jeziku", false],
                   ["Sve ih je donio isti melek istom poslaniku", false]] },

      { tip: "mc",
        pitanje: "Adnan piše test. Zna odgovor kod druga, a nastavnik je izašao iz učionice. Ipak ne prepisuje, jer zna da će jednog dana odgovarati za svako svoje djelo.<br><br>Koje vjerovanje ga je zaustavilo?",
        odgovori: [["Vjerovanje u Sudnji dan", true],
                   ["Vjerovanje u Allahove knjige", false],
                   ["Vjerovanje u Allahove poslanike", false],
                   ["Vjerovanje da je Allah jedan", false]] },

      { tip: "mc",
        pitanje: "Jedna od ovih stvari <strong>ne pripada</strong> imanskim šartima. Koja?",
        odgovori: [["Klanjati pet dnevnih namaza", true],
                   ["Vjerovati u Allahove meleke", false],
                   ["Vjerovati u Sudnji dan", false],
                   ["Vjerovati u Allahove poslanike", false]] },

      { tip: "tf",
        pitanje: "Harun kaže: „Vjerujem u Allaha i u Njegove poslanike, ali ne vjerujem da će biti Sudnji dan.“<br>Njegovo vjerovanje je potpuno.",
        tacno: false },

      { tip: "tf",
        pitanje: "Imanske šarte ne možemo vidjeti očima, ali ih čvrsto držimo u srcu.",
        tacno: true },

      { tip: "blanks",
        uputa: "Popuni praznine.",
        tekst: "Kada Amina vrati novčanik koji je neko izgubio, iako je niko nije vidio, ona pokazuje da vjeruje u *Sudnji* dan. Kada strpljivo podnese bolest, pokazuje da vjeruje u Allahovu *volju* i određenje." },

      { tip: "drag",
        uputa: "Svaka objava ima svog poslanika. Prevuci ime na pravo mjesto.",
        tekst: "Tevrat je objavljen *Musau*, a.s., Zebur *Davudu*, a.s., Indžil *Isau*, a.s., a Kur'an *Muhammedu*, a.s.",
        ometaci: "*Ademu* *Nuhu*" },

      { tip: "mark",
        uputa: "Označi samo ono u što <strong>vjerujemo</strong> — ostalo su djela koja činimo.",
        tekst: "*meleci* namaz *knjige* post *poslanici* zekat *kader* hadž" },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    slug: "islamski-sarti",
    tip: "set",
    naslov: "Islamski šarti — šta radim",
    uvod: "Imanski šarti su ono u što vjerujemo. Islamski su ono što činimo. Razmisli šta se traži u svakoj situaciji.",
    pitanja: [
      { tip: "mc",
        pitanje: "Nermin ima deset godina, zdrav je, a djed mu je ponudio da mu plati put na hadž. Otac mu kaže da hadž još nije njegova obaveza.<br><br>Zašto?",
        odgovori: [["Zato što obaveza nastupa tek kada čovjek postane punoljetan", true],
                   ["Zato što se hadž obavlja samo jednom u životu", false],
                   ["Zato što mu je neko drugi ponudio da plati", false],
                   ["Zato što hadž nije islamski šart", false]] },

      { tip: "mc",
        pitanje: "Amina je od svog džeparca dala novac djetetu iz komšiluka koje nema. To je lijepo djelo, ali <strong>nije</strong> zekat.<br><br>Zašto?",
        odgovori: [["Zato što je zekat tačno propisana obaveza za onoga ko ima dovoljno imetka, a ovo je dobrovoljna sadaka", true],
                   ["Zato što je dala premalo novca", false],
                   ["Zato što zekat smiju davati samo odrasli muškarci", false],
                   ["Zato što zekat nije islamski šart", false]] },

      { tip: "mc",
        pitanje: "Jedan islamski šart izvršavamo <strong>jezikom</strong>, drugi <strong>tijelom</strong>, treći <strong>imetkom</strong>.<br><br>Koji se izvršava jezikom?",
        odgovori: [["Kelime-i šehadet", true], ["Namaz", false], ["Zekat", false], ["Post", false]] },

      { tip: "tf",
        pitanje: "Kenan je teško bolestan i ljekar mu je zabranio da posti ramazan. To znači da on više nije musliman.",
        tacno: false },

      { tip: "tf",
        pitanje: "Izgovaranjem kelime-i šehadeta preuzimamo obavezu da radimo ono što je Allah, dž.š., naredio i da se klonimo onoga što je zabranio.",
        tacno: true },

      { tip: "blanks",
        uputa: "Svaki šart traži nešto drugo od nas. Popuni praznine.",
        tekst: "Namaz izvršavamo *tijelom*, zekat *imetkom*, a kelime-i šehadet *jezikom*." },

      { tip: "drag",
        uputa: "Šta nas svaka dužnost najviše traži? Prevuci riječi.",
        tekst: "Namaz traži naše *vrijeme*, zekat naš *imetak*, post naše *strpljenje*, a hadž naše *putovanje*.",
        ometaci: "*znanje* *pisanje*" },

      { tip: "mark",
        uputa: "Označi samo islamske šarte.",
        tekst: "*šehadet* meleci *namaz* kader *post* knjige *zekat* poslanici *hadž*" },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    slug: "namaski-sarti",
    tip: "set",
    naslov: "Namaski šarti — prije i u namazu",
    uvod: "Šest stvari uradimo prije namaza, šest u toku namaza. U svakoj situaciji pronađi šta nedostaje.",
    pitanja: [
      { tip: "mc",
        pitanje: "Dženana je uzela abdest, obukla se propisno, prostrla serdžadu i okrenula se prema kibli. Stala je i počela klanjati, ali nije odlučila koji namaz klanja.<br><br>Koji namaski uvjet joj nedostaje?",
        odgovori: [["Nijet — odluka koji namaz klanja", true],
                   ["Abdest", false],
                   ["Okretanje prema kibli", false],
                   ["Propisna odjeća", false]] },

      { tip: "mc",
        pitanje: "Faruk je pogledao na sat, vidio da je 11 sati i klanjao podne-namaz. Podnevsko vrijeme tog dana nastupa u 12 sati.<br><br>Koji namaski uvjet nije ispunio?",
        odgovori: [["Na vrijeme klanjati", true],
                   ["Nijet učiniti", false],
                   ["Okrenuti se prema kibli", false],
                   ["Uzeti abdest", false]] },

      { tip: "mc",
        pitanje: "Zašto je sedžda <strong>rukn</strong>, a abdest <strong>uvjet</strong>?",
        odgovori: [["Zato što se rukn izvršava u toku namaza, a uvjet prije nego namaz počne", true],
                   ["Zato što je sedžda važnija od abdesta", false],
                   ["Zato što se abdest uzima samo ujutro", false],
                   ["Zato što ruknova ima više nego uvjeta", false]] },

      { tip: "tf",
        pitanje: "Adnan je klanjao na podu koji nije bio čist, ali je on sam bio čist i imao abdest. Njegov namaz je ispravan.",
        tacno: false },

      { tip: "tf",
        pitanje: "Kada nema vode, abdest se u nuždi može zamijeniti tejemmumom.",
        tacno: true },

      { tip: "blanks",
        uputa: "Popuni praznine.",
        tekst: "Prije namaza Amina uzme abdest i okrene se prema *kibli*. Namaz počinje početnim *tekbirom*, a lice na tlo spušta u *sedždi*." },

      { tip: "drag",
        uputa: "Poredaj namaz po redu — prevuci naziv na pravo mjesto.",
        tekst: "Namaz počinje početnim *tekbirom*, zatim slijedi stajanje ili *kijam*, pa učenje Kur'ana ili *kiraet*, potom pregibanje ili *ruku'*, i spuštanje lica na tlo ili *sedžda*.",
        ometaci: "*nijet* *abdest*" },

      { tip: "mark",
        uputa: "Označi samo ono što uradimo <strong>prije</strong> nego namaz počne.",
        tekst: "*abdest* sedžda *kibla* ruku' *nijet* kijam *čistoća* kiraet" },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    slug: "dinski-sarti",
    tip: "set",
    naslov: "Dinski šarti — cijela slagalica",
    uvod: "Trideset tri šarta složena su u grupe. Razumij kako se slažu, a brojevi će sami doći.",
    pitanja: [
      { tip: "mc",
        pitanje: "Abdeski, gusulski i tejemmumski šarti zajedno se zovu <strong>šartovi čišćenja</strong>.<br><br>Šta im je zajedničko?",
        odgovori: [["Svi se odnose na čistoću, bez koje ibadet nije ispravan", true],
                   ["Svi se izvršavaju samo prije sabah-namaza", false],
                   ["Svih ih ima po četiri", false],
                   ["Svi se uče napamet na arapskom", false]] },

      { tip: "mc",
        pitanje: "Emir kaže: „Klanjam i postim kad me neko gleda. Kad sam sam, ne trudim se mnogo.“<br><br>Šta Emiru nedostaje od onoga što lekcija zove <em>ihsan</em>?",
        odgovori: [["Svijest da ga Allah vidi i onda kada ga ljudi ne vide", true],
                   ["Znanje koliko ima dinskih šarta", false],
                   ["Više vremena za namaz", false],
                   ["Dozvola roditelja", false]] },

      { tip: "mc",
        pitanje: "Ako sabereš imanske i islamske šarte, koliko dobiješ?",
        odgovori: [["Jedanaest", true], ["Dvanaest", false], ["Deset", false], ["Sedamnaest", false]] },

      { tip: "tf",
        pitanje: "Ihsan je jedan od trideset tri dinska šarta.",
        tacno: false },

      { tip: "tf",
        pitanje: "Tejemmum se uzima potiranjem lica i ruku dlanovima od zemlje.",
        tacno: true },

      { tip: "blanks",
        uputa: "Popuni praznine brojevima.",
        tekst: "Dinskih šarta ima *33*: *6* imanskih, *5* islamskih, *12* namaskih i *10* šarta čišćenja." },

      { tip: "drag",
        uputa: "Koliko kojih šarta čišćenja ima? Prevuci brojeve.",
        tekst: "Abdeskih šarta ima *4*, gusulskih *3*, a tejemmumskih *3*.",
        ometaci: "*5* *6*" },

      { tip: "mark",
        uputa: "Označi grupe od kojih se sastoje dinski šarti.",
        tekst: "*imanski* ihsan *islamski* sunnet *namaski* vitr *abdeski* ezan" },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    slug: "ponavljanje-sartovi",
    tip: "set",
    nasumicno: true,
    naslov: "Ponavljanje: prepoznaj situaciju",
    uvod: "Kratko ponavljanje. Pitanja dolaze nasumično — u svakoj situaciji prepoznaj o kojem se šartu radi.",
    pitanja: [
      { tip: "mc",
        pitanje: "Selma je u učionici, blizu je vrijeme ikindije, a ona ne zna gdje je kibla. Pita muallimu.<br><br>Šta Selma zapravo pokušava ispuniti?",
        odgovori: [["Namaski uvjet — okrenuti se prema kibli", true],
                   ["Namaski rukn — kijam", false],
                   ["Imanski šart", false],
                   ["Abdeski šart", false]] },

      { tip: "mc",
        pitanje: "Tarik je cijeli dan bio gladan i žedan, iako je hrana bila pred njim, jer je ramazan.<br><br>Koji islamski šart Tarik izvršava?",
        odgovori: [["Treći — ramazanski post", true], ["Drugi — namaz", false],
                   ["Četvrti — zekat", false], ["Peti — hadž", false]] },

      { tip: "mc",
        pitanje: "Lejla vjeruje da postoje bića koja zapisuju njena djela, iako ih ne vidi.<br><br>Na koji imanski šart se to odnosi?",
        odgovori: [["Drugi — vjerovanje u Allahove meleke", true],
                   ["Prvi — vjerovanje u Allaha", false],
                   ["Peti — vjerovanje u Sudnji dan", false],
                   ["Šesti — vjerovanje u kader", false]] },

      { tip: "mc",
        pitanje: "Šta od ovoga <strong>nije</strong> uvjet koji se ispunjava prije namaza?",
        odgovori: [["Ruku'", true], ["Abdest", false], ["Nijet", false], ["Propisna odjeća", false]] },

      { tip: "tf",
        pitanje: "Vjerovanje u meleke je imanski, a ne islamski šart.",
        tacno: true },

      { tip: "tf",
        pitanje: "Abdest je namaski rukn, jer se uzima u toku namaza.",
        tacno: false },

      { tip: "blanks",
        uputa: "Popuni praznine.",
        tekst: "Kada Emina prije namaza odluči koji namaz klanja, ona čini *nijet*. Kada se okrene prema Kabi, okrenula se prema *kibli*." },

      { tip: "drag",
        uputa: "Gdje pripada koji šart? Prevuci riječi.",
        tekst: "Vjerovanje u Sudnji dan je *imanski* šart, davanje zekata je *islamski* šart, a spuštanje lica na tlo je namaski *rukn*.",
        ometaci: "*abdeski* *gusulski*" },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    slug: "sartovi-brzo",
    tip: "scs",
    naslov: "Brzo razmisli — šartovi",
    uvod: "Deset kratkih situacija. Bez razmišljanja o brojevima — samo prepoznaj o čemu se radi.",
    pitanja: [
      { pitanje: "Dijete strpljivo podnosi bolest jer zna da je sve od Allaha. Koji šart?",
        odgovori: ["Imanski — vjerovanje u kader", "Islamski — post", "Namaski rukn", "Abdeski šart"] },
      { pitanje: "Otac odvaja dio zarade i daje siromašnima jer je to obaveza. Šta izvršava?",
        odgovori: ["Zekat", "Sadaku", "Hadž", "Nijet"] },
      { pitanje: "Neko pere lice, ruke do iza lakata, potire glavu i pere noge. Šta radi?",
        odgovori: ["Uzima abdest", "Uzima tejemmum", "Klanja namaz", "Čini nijet"] },
      { pitanje: "U namazu se prvi put izgovara „Allahu ekber“. Kako se zove taj rukn?",
        odgovori: ["Iftitahi-tekbir", "Kijam", "Kiraet", "Sedžda"] },
      { pitanje: "Dijete kaže da vjeruje u Allaha, ali ne i u Njegove poslanike. Šta je tačno?",
        odgovori: ["Vjerovanje mu nije potpuno", "Vjerovanje mu je potpuno", "To je namaski uvjet", "To je islamski šart"] },
      { pitanje: "Putnik je u pustinji, nema ni kapi vode, a nastupilo je vrijeme namaza. Šta čini?",
        odgovori: ["Uzima tejemmum", "Ne klanja", "Klanja bez abdesta", "Čeka do sutra"] },
      { pitanje: "Šta se od ovoga NE izvršava tijelom?",
        odgovori: ["Kelime-i šehadet", "Namaz", "Hadž", "Post"] },
      { pitanje: "Muallima kaže: „Ovo se ispunjava PRIJE nego namaz počne.“ Na šta misli?",
        odgovori: ["Na namaske uvjete", "Na namaske ruknove", "Na imanske šarte", "Na gusulske šarte"] },
      { pitanje: "Neko čini dobro djelo i kad ga niko ne gleda. Kako se zove taj stupanj?",
        odgovori: ["Ihsan", "Iman", "Islam", "Nijet"] },
      { pitanje: "Kur'an, Indžil, Zebur i Tevrat — na koji imanski šart nas podsjećaju?",
        odgovori: ["Vjerovanje u Allahove knjige", "Vjerovanje u meleke", "Vjerovanje u Sudnji dan", "Vjerovanje u kader"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    slug: "sartovi-kartice",
    tip: "kartice",
    naslov: "Kartice za ponavljanje — šartovi",
    uvod: "Pročitaj situaciju, razmisli, pa okreni karticu. Kartice koje ne znaš vraćaju se češće.",
    kartice: [
      { lice: "Dijete se naljutilo zbog nečega što nije moglo promijeniti, pa se smirilo sjetivši se da je sve od Allaha. Koji imanski šart?",
        nalicje: "Šesti — vjerovanje u kader: da se sve događa Allahovom voljom i određenjem." },
      { lice: "U čemu je razlika između zekata i sadake?",
        nalicje: "Zekat je propisana obaveza za onoga ko ima dovoljno imetka. Sadaka je dobrovoljno davanje, u bilo kojem iznosu." },
      { lice: "Zašto nijet nije rukn nego uvjet?",
        nalicje: "Zato što se čini prije nego namaz počne. Ruknovi su ono što radimo u toku namaza." },
      { lice: "Neko ima abdest, čist je i propisno obučen, ali je namaz klanjao prije nastupanja vremena. Je li namaz ispravan?",
        nalicje: "Nije. „Na vrijeme klanjati“ je jedan od šest namaskih uvjeta." },
      { lice: "Koja tri rukna dolaze poslije kijama?",
        nalicje: "Kiraet (učenje Kur'ana), ruku' (pregibanje) i sedžda (spuštanje lica na tlo)." },
      { lice: "Šta znači ihsan?",
        nalicje: "Najveći stupanj svijesti o Uzvišenom Allahu — kao da Ga vidimo; a ako mi Njega ne vidimo, On vidi nas." },
      { lice: "Koji islamski šart se izvršava samo jezikom?",
        nalicje: "Kelime-i šehadet — izgovaranje svjedočenja." },
      { lice: "Kada se abdest zamjenjuje tejemmumom?",
        nalicje: "Kada nema vode — u nuždi. Potiru se lice i ruke do iza lakata dlanovima od zemlje." },
      { lice: "Šta je zajedničko Tevratu, Zeburu, Indžilu i Kur'anu?",
        nalicje: "Sve su Allahove objave — treći imanski šart: <em>ve kutubihi</em>." },
      { lice: "Od kojih grupa se sastoje 33 dinska šarta?",
        nalicje: "6 imanskih + 5 islamskih + 12 namaskih + 10 šarta čišćenja (4 abdeska, 3 gusulska, 3 tejemmumska)." },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    slug: "sartovi-pojmovi",
    tip: "flash",
    naslov: "Pogodi pojam — šartovi",
    uvod: "Pročitaj opis i upiši pojam. Odgovor je uvijek jedna riječ.",
    kartice: [
      { opis: "Odluka srcem koji namaz klanjamo, prije nego namaz počne.", odgovor: "nijet" },
      { opis: "Smjer prema kojem se okrećemo kada klanjamo.", odgovor: "kibla" },
      { opis: "Zamjena za abdest kada nema vode.", odgovor: "tejemmum" },
      { opis: "Stupanj svijesti da nas Allah vidi i kad nas ljudi ne vide.", odgovor: "ihsan" },
      { opis: "Spuštanje lica na tlo u namazu.", odgovor: "sedžda" },
      { opis: "Pregibanje u namazu, poslije učenja Kur'ana.", odgovor: "ruku" },
      { opis: "Stajanje u namazu.", odgovor: "kijam" },
      { opis: "Učenje Kur'ana u namazu.", odgovor: "kiraet" },
      { opis: "Propisano izdvajanje dijela imetka za one kojima treba.", odgovor: "zekat" },
      { opis: "Pranje lica, ruku, potiranje glave i pranje nogu prije namaza.", odgovor: "abdest" },
    ],
  },
];
