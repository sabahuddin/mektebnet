/**
 * Transkripcija kur'anskog teksta i dova iz mektebskog programa.
 *
 * Piše se SAMO engleski oblik; njemački se iz njega izvodi mehanički
 * (vidi `njemackiIzEngleskog`), jer engleski zapis čuva sve razlike koje
 * njemački pravopis traži. Tako postoji jedan izvor istine i njemački ne
 * može odlutati od engleskog.
 *
 * Ključ `bs` je bosanski zapis kako stoji u lekciji; poređenje ide
 * normalizirano, pa sitne razlike u crticama i apostrofima ne smetaju.
 *
 * VAŽNO: ovo je vjerski tekst koji djeca uče napamet. Prije objave ga
 * pregleda urednik uz mushaf — `pnpm --filter @workspace/scripts exec tsx
 * src/ispisi-transkripciju.ts` ispisuje cijeli spisak za provjeru.
 */

export interface ZapisTranskripcije {
  /** Bosanski zapis iz lekcije. */
  bs: string;
  /** Engleska transkripcija; njemačka se izvodi iz nje. */
  en: string;
}

/** Sura ili dova sa svojim redovima. */
export interface Cjelina {
  naziv: string;
  redovi: ZapisTranskripcije[];
}

export const CJELINE: Cjelina[] = [
  {
    naziv: "Euzu i bismilla",
    redovi: [
      { bs: "Euzu billahi mineš-šejtanir-radžim", en: "A'udhu billahi minash-shaytanir-rajim" },
      { bs: "Bismillahir-rahmanir-rahim", en: "Bismillahir-Rahmanir-Rahim" },
    ],
  },
  {
    naziv: "El-Fatiha",
    redovi: [
      { bs: "Elhamdu lillahi rabbil-alemin", en: "Alhamdu lillahi Rabbil-alamin" },
      { bs: "Er-rahmanir-rahim", en: "Ar-Rahmanir-Rahim" },
      { bs: "Maliki jevmid-din", en: "Maliki yawmid-din" },
      { bs: "Ijjake na'budu ve ijjake neste'in", en: "Iyyaka na'budu wa iyyaka nasta'in" },
      { bs: "Ihdines-siratal-mustekim", en: "Ihdinas-siratal-mustaqim" },
      {
        bs: "Siratallezine en'amte alejhim gajril-magdubi alejhim ve led-dallin",
        en: "Siratal-ladhina an'amta alayhim, ghayril-maghdubi alayhim wa lad-dallin",
      },
    ],
  },
  {
    naziv: "El-Ihlas",
    redovi: [
      { bs: "Kul huvallahu ehad", en: "Qul huwallahu ahad" },
      { bs: "Allahus-samed", en: "Allahus-samad" },
      { bs: "Lem jelid ve lem juled", en: "Lam yalid wa lam yulad" },
      { bs: "Ve lem jekun lehu kufuven ehad", en: "Wa lam yakun lahu kufuwan ahad" },
    ],
  },
  {
    naziv: "El-Felek",
    redovi: [
      { bs: "Kul e'uzu bi rabbil-felek", en: "Qul a'udhu bi Rabbil-falaq" },
      { bs: "Min šerri ma halek", en: "Min sharri ma khalaq" },
      { bs: "Ve min šerri gasikin iza vekab", en: "Wa min sharri ghasiqin idha waqab" },
      { bs: "Ve min šerrin-neffasati fil-ukad", en: "Wa min sharrin-naffathati fil-'uqad" },
      { bs: "Ve min šerri hasidin iza hased", en: "Wa min sharri hasidin idha hasad" },
    ],
  },
  {
    naziv: "En-Nas",
    redovi: [
      { bs: "Kul e'uzu bi rabbin-nas", en: "Qul a'udhu bi Rabbin-nas" },
      { bs: "Melikin-nas", en: "Malikin-nas" },
      { bs: "Ilahin-nas", en: "Ilahin-nas" },
      { bs: "Min šerril-vesvasil-hannas", en: "Min sharril-waswasil-khannas" },
      { bs: "Ellezi juvesvisu fi sudurin-nas", en: "Alladhi yuwaswisu fi sudurin-nas" },
      { bs: "Minel-džinneti ven-nas", en: "Minal-jinnati wan-nas" },
    ],
  },
  {
    naziv: "El-Kafirun",
    redovi: [
      { bs: "Kul ja ejjuhel-kafirun", en: "Qul ya ayyuhal-kafirun" },
      { bs: "La a'budu ma ta'budun", en: "La a'budu ma ta'budun" },
      { bs: "Ve la entum abidune ma a'bud", en: "Wa la antum 'abiduna ma a'bud" },
      { bs: "Ve la ene abidun ma abedtum", en: "Wa la ana 'abidun ma 'abadtum" },
      { bs: "Lekum dinukum ve lije din", en: "Lakum dinukum wa liya din" },
    ],
  },
  {
    naziv: "El-Kevser",
    redovi: [
      { bs: "Inna a'tajnakel-kevser", en: "Inna a'taynakal-kawthar" },
      { bs: "Fesalli li rabbike venhar", en: "Fasalli li Rabbika wanhar" },
      { bs: "Inne šanieke huvel-ebter", en: "Inna shani'aka huwal-abtar" },
    ],
  },
  {
    naziv: "El-Asr",
    redovi: [
      { bs: "Vel-asr", en: "Wal-'asr" },
      { bs: "Innel-insane lefi husr", en: "Innal-insana lafi khusr" },
      {
        bs: "Illellezine amenu ve amilus-salihati ve tevasav bil-hakki ve tevasav bis-sabr",
        en: "Illalladhina amanu wa 'amilus-salihati wa tawasaw bil-haqqi wa tawasaw bis-sabr",
      },
    ],
  },
  {
    naziv: "En-Nasr",
    redovi: [
      { bs: "Iza dža'e nasrullahi vel-feth", en: "Idha ja'a nasrullahi wal-fath" },
      { bs: "Ve re'ejten-nase jedhulune fi dinillahi efvadža", en: "Wa ra'aytan-nasa yadkhuluna fi dinillahi afwaja" },
      { bs: "Fesebbih bihamdi rabbike vestagfirh, innehu kane tevvaba", en: "Fasabbih bihamdi Rabbika wastaghfirh, innahu kana tawwaba" },
    ],
  },
  {
    naziv: "El-Maun",
    redovi: [
      { bs: "Erejtellezi jukezzibu bid-din", en: "Ara'aytalladhi yukadhdhibu bid-din" },
      { bs: "Fezalikellezi jedu'ul-jetim", en: "Fadhalikalladhi yadu''ul-yatim" },
      { bs: "Ve la jehuddu ala ta'amil-miskin", en: "Wa la yahuddu 'ala ta'amil-miskin" },
      { bs: "Fevejlun lil-musallin", en: "Fawaylul-lilmusallin" },
      { bs: "Ellezine hum an salatihim sahun", en: "Alladhina hum 'an salatihim sahun" },
      { bs: "Ellezine hum jura'un", en: "Alladhina hum yura'un" },
      { bs: "Ve jemne'unel-maun", en: "Wa yamna'unal-ma'un" },
    ],
  },
  {
    naziv: "El-Kurejš",
    redovi: [
      { bs: "Li ilafi Kurejš", en: "Li'ilafi Quraysh" },
      { bs: "Ilafihim rihleteš-šitai ves-sajf", en: "Ilafihim rihlatash-shita'i was-sayf" },
      { bs: "Felja'budu rabbe hazel-bejt", en: "Falya'budu Rabba hadhal-bayt" },
      { bs: "Ellezi at'amehum min džu'in ve amenehum min havf", en: "Alladhi at'amahum min ju'in wa amanahum min khawf" },
    ],
  },
  {
    naziv: "El-Fil",
    redovi: [
      { bs: "Elem tere kejfe fe'ale rabbuke bi ashabil-fil", en: "Alam tara kayfa fa'ala Rabbuka bi ashabil-fil" },
      { bs: "Elem jedž'al kejdehum fi tadlil", en: "Alam yaj'al kaydahum fi tadlil" },
      { bs: "Ve ersele alejhim tajren ebabil", en: "Wa arsala 'alayhim tayran ababil" },
      { bs: "Termihim bi hidžaretin min siddžil", en: "Tarmihim bihijaratin min sijjil" },
      { bs: "Fedže'alehum ke'asfin me'kul", en: "Faja'alahum ka'asfin ma'kul" },
    ],
  },
  {
    naziv: "El-Humeze",
    redovi: [
      { bs: "Vejlun li kulli humezetil-lumeze", en: "Waylul-likulli humazatil-lumazah" },
      { bs: "Ellezi džeme'a malen ve addedeh", en: "Alladhi jama'a malan wa 'addadah" },
      { bs: "Jahsebu enne malehu ahledeh", en: "Yahsabu anna malahu akhladah" },
      { bs: "Kella, lejunbezenne fil-hutame", en: "Kalla, layunbadhanna fil-hutamah" },
      { bs: "Ve ma edrake mel-hutame", en: "Wa ma adraka mal-hutamah" },
      { bs: "Narullahil-mukade", en: "Narullahil-muqadah" },
      { bs: "Elleti tettali'u alel-ef'ide", en: "Allati tattali'u 'alal-af'idah" },
      { bs: "Inneha alejhim mu'sade", en: "Innaha 'alayhim mu'sadah" },
      { bs: "Fi amedin mumeddede", en: "Fi 'amadin mumaddadah" },
    ],
  },
  {
    naziv: "El-Leheb",
    redovi: [
      { bs: "Tebbet jeda ebi lehebin ve tebb", en: "Tabbat yada abi Lahabin wa tabb" },
      { bs: "Ma agna anhu maluhu ve ma keseb", en: "Ma aghna 'anhu maluhu wa ma kasab" },
      { bs: "Sejasla naren zate leheb", en: "Sayasla naran dhata lahab" },
      { bs: "Vemre'etuhu hammaletel-hatab", en: "Wamra'atuhu hammalatal-hatab" },
      { bs: "Fi džidiha hablun min mesed", en: "Fi jidiha hablun min masad" },
    ],
  },
  {
    naziv: "El-Kadr",
    redovi: [
      { bs: "Inna enzelnahu fi lejletil-kadr", en: "Inna anzalnahu fi laylatil-qadr" },
      { bs: "Ve ma edrake ma lejletul-kadr", en: "Wa ma adraka ma laylatul-qadr" },
      { bs: "Lejletul-kadri hajrun min elfi šehr", en: "Laylatul-qadri khayrun min alfi shahr" },
      {
        bs: "Tenezzelul-melaiketu ver-ruhu fiha bi izni rabbihim min kulli emr",
        en: "Tanazzalul-mala'ikatu war-ruhu fiha bi idhni Rabbihim min kulli amr",
      },
      { bs: "Selamun hije hatta matle'il-fedžr", en: "Salamun hiya hatta matla'il-fajr" },
    ],
  },
  {
    naziv: "El-Bejjine",
    redovi: [
      {
        bs: "Lem jekunillezine keferu min ehlil-kitabi vel-mušrikine munfekkine hatta te'tijehumul-bejjine",
        en: "Lam yakunilladhina kafaru min ahlil-kitabi wal-mushrikina munfakkina hatta ta'tiyahumul-bayyinah",
      },
      { bs: "Resulun minallahi jetlu suhufen mutahhere", en: "Rasulun minallahi yatlu suhufan mutahharah" },
      { bs: "Fiha kutubun kajjime", en: "Fiha kutubun qayyimah" },
      {
        bs: "Ve ma teferrekallezine utul-kitabe illa min ba'di ma džaethumul-bejjine",
        en: "Wa ma tafarraqalladhina utul-kitaba illa min ba'di ma ja'at-humul-bayyinah",
      },
      {
        bs: "Ve ma umiru illa lija'budullahe muhlisine lehud-dine hunefae ve jukimus-salate ve ju'tuz-zekate ve zalike dinul-kajjime",
        en: "Wa ma umiru illa liya'budullaha mukhlisina lahud-dina hunafa'a wa yuqimus-salata wa yu'tuz-zakata wa dhalika dinul-qayyimah",
      },
      {
        bs: "Innellezine keferu min ehlil-kitabi vel-mušrikine fi nari džehenneme halidine fiha, ulaike hum šerrul-berijje",
        en: "Innalladhina kafaru min ahlil-kitabi wal-mushrikina fi nari jahannama khalidina fiha, ula'ika hum sharrul-bariyyah",
      },
      {
        bs: "Innellezine amenu ve amilus-salihati ulaike hum hajrul-berijje",
        en: "Innalladhina amanu wa 'amilus-salihati ula'ika hum khayrul-bariyyah",
      },
      {
        bs: "Džezauhum inde rabbihim džennatu adnin tedžri min tahtihel-enharu halidine fiha ebeda, radijallahu anhum ve radu anh, zalike limen hašije rabbeh",
        en: "Jaza'uhum 'inda Rabbihim jannatu 'adnin tajri min tahtihal-anharu khalidina fiha abada, radiyallahu 'anhum wa radu 'anh, dhalika liman khashiya Rabbah",
      },
    ],
  },
  {
    naziv: "Subhaneke (dova iftitah)",
    redovi: [
      {
        bs: "Subhanekellahumme ve bihamdike ve tebarekesmuke ve te'ala džedduke ve la ilahe gajruk",
        en: "Subhanakallahumma wa bihamdika wa tabarakasmuka wa ta'ala jadduka wa la ilaha ghayruk",
      },
    ],
  },
  {
    naziv: "Ettehijjatu",
    redovi: [
      { bs: "Ettehijjatu lillahi ves-salavatu vet-tajjibat", en: "At-tahiyyatu lillahi was-salawatu wat-tayyibat" },
      {
        bs: "Esselamu alejke ejjuhen-nebijju ve rahmetullahi ve berekatuh",
        en: "As-salamu 'alayka ayyuhan-nabiyyu wa rahmatullahi wa barakatuh",
      },
      { bs: "Esselamu alejna ve ala ibadillahis-salihin", en: "As-salamu 'alayna wa 'ala 'ibadillahis-salihin" },
      {
        bs: "Ešhedu en la ilahe illallah ve ešhedu enne Muhammeden abduhu ve resuluh",
        en: "Ashhadu an la ilaha illallah wa ashhadu anna Muhammadan 'abduhu wa rasuluh",
      },
    ],
  },
  {
    naziv: "Salavati",
    redovi: [
      {
        bs: "Allahumme salli ala Muhammedin ve ala ali Muhammed, kema sallejte ala Ibrahime ve ala ali Ibrahim, inneke hamidun medžid",
        en: "Allahumma salli 'ala Muhammadin wa 'ala ali Muhammad, kama sallayta 'ala Ibrahima wa 'ala ali Ibrahim, innaka hamidun majid",
      },
      {
        bs: "Allahumme barik ala Muhammedin ve ala ali Muhammed, kema barekte ala Ibrahime ve ala ali Ibrahim, inneke hamidun medžid",
        en: "Allahumma barik 'ala Muhammadin wa 'ala ali Muhammad, kama barakta 'ala Ibrahima wa 'ala ali Ibrahim, innaka hamidun majid",
      },
    ],
  },
  {
    naziv: "Rabbena dove",
    redovi: [
      {
        bs: "Rabbena atina fid-dunja hasenaten ve fil-ahireti hasenaten ve kina azaben-nar",
        en: "Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan wa qina 'adhaban-nar",
      },
      {
        bs: "Rabbenagfir li ve li validejje ve lil-mu'minine jevme jekumul-hisab",
        en: "Rabbanaghfir li wa liwalidayya wa lil-mu'minina yawma yaqumul-hisab",
      },
    ],
  },
  {
    naziv: "Kunut-dova",
    redovi: [
      {
        bs: "Allahumme inna neste'inuke ve nestagfiruke ve nestehdik, ve nu'minu bike ve netubu ilejk",
        en: "Allahumma inna nasta'inuka wa nastaghfiruka wa nastahdik, wa nu'minu bika wa natubu ilayk",
      },
      {
        bs: "Ve netevekkelu alejke ve nusni alejkel-hajre kullehu, neškuruke ve la nekfuruk, ve nahle'u ve netruku men jefdžuruk",
        en: "Wa natawakkalu 'alayka wa nuthni 'alaykal-khayra kullahu, nashkuruka wa la nakfuruk, wa nakhla'u wa natruku man yafjuruk",
      },
      {
        bs: "Allahumme ijjake na'budu ve leke nusalli ve nesdžud, ve ilejke nes'a ve nahfid",
        en: "Allahumma iyyaka na'budu wa laka nusalli wa nasjud, wa ilayka nas'a wa nahfid",
      },
      {
        bs: "Nerdžu rahmeteke ve nahša azabek, inne azabeke bil-kuffari mulhik",
        en: "Narju rahmataka wa nakhsha 'adhabak, inna 'adhabaka bil-kuffari mulhiq",
      },
    ],
  },
];
