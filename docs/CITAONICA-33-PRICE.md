# 33 priče za djecu u Čitaonici

Knjiga „33 priče za djecu — islamske vrijednosti u praksi" (tekst i ilustracije)
ide uz platformu. Priče se u Čitaonicu unose **jednim klikom u admin panelu**,
a ne ručnim prepisivanjem.

## Kako se unose

1. **Admin panel → Čitaonica.** Ako neka priča iz knjige nedostaje, na vrhu
   stoji kartica **„33 priče za djecu"** i piše koliko ih nedostaje.
2. Otvori **„Koje priče nedostaju"** ako želiš vidjeti spisak.
3. Odaberi **kategoriju** u koju idu i klikni **Uvezi**.

Uvoz je siguran i može se ponoviti: **priča koja već postoji se preskače** — i
kad je ranije unesena ručno pod drugom oznakom, jer se poredi i naslov (bez
razlike u velikim slovima i kvačicama). Zato dugme nikad ne pravi duplikate.

Kad su sve priče u Čitaonici, kartica za uvoz se više i ne prikazuje.

## Šta uvoz upisuje

| Polje | Vrijednost |
|---|---|
| `naslov` | naslov priče iz knjige |
| `slug` | naslov bez kvačica, npr. `bismilla-i-mali-hamza` |
| `kategorija` | ona koju odabereš pri uvozu |
| `contentHtml` | tema priče (kurziv) pa pasusi `<p>` |
| `coverImage` | ilustracija iz knjige, npr. `/citaonica/33-price/01-bismilla-i-mali-hamza.jpg` |
| `redoslijed` | broj priče u knjizi (1–33) |
| `isPublished` | `true` |

Stranica priče sama dijeli tekst na stranice po broju riječi, pa dugačke priče
dijete čita u dva-tri koraka.

## Gdje šta stoji

| Fajl | Uloga |
|---|---|
| `api-server/src/data/citaonica-33-price.ts` | sve 33 priče (naslov, tema, pasusi) — ide uz server |
| `mekteb-arapsko-pismo/public/citaonica/33-price/*.jpg` | 33 ilustracije (720×720, oko 2,9 MB ukupno) |
| `api-server/src/routes/admin.ts` | `GET/POST /api/admin/knjige/uvoz-33-price` (admin-only) |
| `src/pages/admin-citaonica.tsx` | kartica za uvoz u admin panelu |

Tekst je prepisan iz knjige **onakav kakav jeste** — pasusi, dijalozi i
interpunkcija su kao u izvorniku; ništa nije prepisivano ni skraćivano.

## Ako treba dopuniti ili ispraviti priču

Priče su poslije uvoza obične priče u Čitaonici — uređuju se kroz
**Admin panel → Čitaonica → Uredi**, kao i svaka druga. Izmjena u bazi ostaje;
ponovni uvoz je ne dira (preskače postojeće).
