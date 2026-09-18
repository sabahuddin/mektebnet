# Zvuk u vježbama

Naše vježbe se javljaju kratkim, tihim tonom. Cilj je da dijete osjeti kad je
nešto riješilo, a da dvadesetero djece u istoj prostoriji ne pravi buku.

## Šta se čuje

| Kad | Šta | Koliko traje |
|---|---|---|
| jedna riječ pronađena (osmosmjerka) | jedan tih „tik" (880 Hz) | 0,1 s |
| provjera pokaže greške | mekan niski ton (196 Hz), **tiši** od tačnog | 0,16 s |
| vježba riješena | tri note naviše (D–G–H) | 0,32 s |

Jačina je 0,035–0,075 (od 1) — namjerno ispod govora. Nema zvuka pri
prevlačenju, biranju, vraćanju riječi ni kod dugmeta „Pomozi mi".

## Kako je napravljeno

Tonove pravi sam preglednik (Web Audio), pa **nema nijedne zvučne datoteke ni
ijednog zahtjeva prema vanjskoj domeni**. Sve je u `public/vjezbe/zvuk.js`
(oko 90 redova), koji sve vježbe učitavaju s naše domene. Ako se taj fajl ne
učita, vježbe rade normalno — samo bez zvuka.

Preglednici ne daju zvuk dok dijete nešto ne dodirne, pa se zvučni sistem budi
pri prvom dodiru ili tipki u vježbi.

## Kako se gasi

Vježbe su na istoj domeni kao platforma, pa čitaju iste postavke:

| Gdje | Ključ | Efekt |
|---|---|---|
| zvučnik u zaglavlju platforme | `mekteb-audio-muted` | gasi sve, pa i vježbe |
| „zvučni efekti" u profilu učenika | `mekteb:soundEffectsEnabled` | isto |
| adresa vježbe | `?zvuk=ne` | gasi samo tu vježbu |

## Šta već postoji drugdje na platformi

Kviz, etapna vježba i lekcija na kraju pokažu `CelebrationModal`, koji pušta
`public/sounds/reward.wav` (`lib/sound-prefs.ts`). To je odvojen, duži zvuk i
ostaje kakav jeste; gasi ga isti zvučnik u zaglavlju.

## Provjera

```bash
node artifacts/mekteb-arapsko-pismo/scripts/provjeri-zvuk.mjs
```

Umjesto zvučnika skripta podmetne lažni Web Audio i broji tonove: koliko ih je,
koje su frekvencije, koliko traju i koliko su jaki. Provjerava i da vježba šuti
kad je zvuk ugašen, i da nema nijedne zvučne datoteke ni vanjskog zahtjeva.
