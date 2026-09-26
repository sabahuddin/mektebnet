# Mekteb.net — pravila projekta

## Arapski zapis

**Zadnji harf svakog zapisa nosi vokal, tenvin, sukun ili tešdid.** Bez toga
sintetizator pogađa ono što nije napisano: imenici doda padežni nastavak
(`مال` pročita kao *malun*), glagolu odsiječe zadnji vokal (`كان` pročita kao
*kan*). Dijete tada vidi jedno, a čuje drugo.

```
مَالْ   ne  مال        كَانَ   ne  كان        قَمَرْ   ne  قَمَر
```

Dvije stvari nisu iznimke nego pravopis:

- **Harf produženja na kraju znak ne nosi** — nosi ga harf ispred njega:
  `مَا`, `لَا`, `بَا`.
- **Tešdid na kraju nikad ne prima sukun.** `أُمّ`, `حُبّ`, `سِرّ` već znače
  pauzalni izgovor i pišu se tako kako jesu.

Pravilo čuva `zavrsetakOznacen()` u `artifacts/mekteb-arapsko-pismo/src/lib/sufara-zapis.ts`,
a test `src/lib/zavrsetak-zapisa.test.ts` pada ako ijedan zapis u vježbama
prestane da ga poštuje.

**Završni sukun nije gradivo.** Sukun koji dijete uči jeste onaj usred riječi,
koji zatvara slog (vav u `يَوْمْ`). Završni je pravopis, pa ga raspoređivač
lekcija ne broji — inače bi svaka riječ tražila šestu lekciju.

**Tešdid se piše prije samoglasnika** (`0651` pa `064E`). NFC ih slaže obrnuto,
pa svaki zapis prije upotrebe prolazi kroz `normalizirajZapis()`. Zapisi
složeni obrnutim redom izgledaju identično, a druga su niska — traženje snimka
po ključu ih ne nađe.

**Kur'anski tekst se nikad ne kuca napamet**, nego se dovlači iz istog izvora
iz kojeg ga dovlači kur'anski modul.

## Zvuk

Snimci stoje u `artifacts/mekteb-arapsko-pismo/public/audio/opismenjavanje/`,
u formatu mono 44,1 kHz, 96 kb/s MP3, tišina odsječena, jačina izjednačena na
−18 LUFS.

Ime datoteke je `rijec-<cijeli zapis u heksadekadnom zapisu>.mp3`. **Ne
skraćivati.** Dok se skraćivalo na osam bajtova, `أَمَلْ` i `أَمَامْ` su
dobijali isto ime i dijelili bi jedan snimak.

Postupak snimanja i obrade opisan je u `docs/snimanje-glasa.md`.

## Baza

**`lib/db/src/schema/` se ne dira.**

## Provjere prije slanja

```
pnpm run typecheck
pnpm --filter @workspace/scripts run test:frontend-lib
node artifacts/mekteb-arapsko-pismo/scripts/provjeri-slusaj.mjs lekcija-4.json
node artifacts/mekteb-arapsko-pismo/scripts/provjeri-izgovor.mjs
```

Za tipove uvijek `pnpm run typecheck`, nikad goli `tsc`.

## Učim čitati (`/citanje`)

Zaseban dio platforme, foničko-slogovni model. Ne traži ništa iz Sufare ni iz
lekcija mekteba.

**Imena slova se ne spominju nigdje** — ni u priči, ni u vježbi, ni u uputi
koju muallim čita naglas. Dijete uči kako slovo zvuči, ne kako se zove. Zato u
`citanje-*.ts` nema polja „naziv", za razliku od stare Sufare gdje postoji i
`HarfData.name` i vježba „Napiši ime harfa".

**Redoslijed slova je izračunat, ne abecedni.** Česta slova prva, a slična
(`ب ت ث ن ي`, `ج ح خ`, `د ذ`, `ر ز`, `س ش`, `ص ض`, `ط ظ`, `ع غ`, `ف ق`) se
razdvajaju u vremenu. Vidjeti zaglavlje `citanje-program.ts`.

**Svako slovo ima sliku, i slike stoje u porodicama.** Dijete ne pamti
geometriju („uspravna linija sa crticom pri dnu") nego predmet: `ب` je čamac,
`ع` uho, `ن` zdjelica. Slova istog kostura dijele sliku i razlikuju se samo
tačkicama — čamac `ب ت ث`, usta `ح ج خ`, patka `ص ض`. To se slaže s razdvajanjem
sličnih slova u vremenu: kad drugo slovo porodice dođe, lekcijama kasnije,
dijete na poznatu sliku samo dodaje tačkicu. Slike stoje u
`citanje-asocijacije.ts`, a `citanje-asocijacije.test.ts` pada ako slovo iz
programa ostane bez slike, ako slika ostane za izbačenim slovom, ili ako dva
slova iste porodice dođu u istu lekciju.

**Ruka ide prije prepoznavanja.** Redoslijed vježbi je oko, pa ruka, pa lov:
`oblici` → `pisi` → `pronadi-harf`. Oblik koji je prošao samo kroz oko raspada
se čim slovo stane u nepoznatu riječ. Test čuva taj poredak.

**Tečnost se ne stiče na času nego između časova.** Zato svaka lekcija ima
radni list za printanje (`radniList()`) i kratku domaću (`domaca`) — dva
prolaza dnevno po dvije minute, ne jedan dug. Pri štampi se ostatak stranice
sakriva preko `visibility`, ne `display: none`, jer bi `display` na roditelju
odnio i samu tabelu.

**Boji se grozd, ne harek.** Mjereno u pregledniku: span oko samog hareka
preglednik zanemari (0 obojenih piksela), a boja harfa povuče i harek uz sebe.
Bojenje hareka u jednu a harfa u drugu boju — kako rade neki arapski bukvari —
ovdje nije moguće. Isto mjerenje pokazalo je i drugu stranu: `مَالَ` ima istu
širinu složen u jednom komadu i razlomljen na tri spana, pa **span ne lomi
spajanje slova** i jedan harf se smije istaknuti i usred riječi. Razlaganje
radi `citanje-grozd.ts`.

**Boje su tri i nose značenje**: crvena je ono što lekcija uvodi, plava je
dužina, siva je tatvil. Četvrta boja na istom zapisu prestaje biti isticanje i
postaje šara. Dužina se prepoznaje po hareku ispred, ne po harfu — vav sa
fethom je suglasnik, vav iza damme je dužina (`jeDuzina()`).

**Imena položaja stoje u `citanje-oblici.ts`**, u `NAZIV_POLOZAJA`, i odatle
se uzimaju. Dok ih je vježba prepisivala, tabela oblika izgubila je kolonu
„na kraju" jer je u njoj stajao izmišljen ključ.

**Svaki arapski red mora imati `dir="rtl"`.** Bez toga dijelovi riječi idu
slijeva nadesno, pa dijete uči obrnut redoslijed čitanja.

Zvuk se pravi sa `scripts/generisi-zvuk-citanja.mjs`. U okruženju s posrednikom
treba `NODE_USE_ENV_PROXY=1`, jer Node-ov `fetch` inače ne vidi posrednika koji
ubacuje ključ, pa Google odbije zahtjev.
