# Mekteb — Digitalna islamska edukativna platforma

## Platforma za mektebsku pouku i islamsko obrazovanje

Mekteb.net je **full-stack LMS (Learning Management System)** namijenjen digitalnoj mektebskoj nastavi, samostalnom učenju djece i roditeljskom praćenju napretka. Platforma pokriva sve aspekte islamske edukacije za djecu u dobi 7–12 godina, od Ilmihal lekcija i Kur'anskog tecvida do edukativnih igrica i roditeljsko-muallim komunikacije.

---

## Arhitektura

- **Frontend:** React + Vite + Tailwind CSS + shadcn/ui + Framer Motion
- **Backend:** Node.js + Express + Drizzle ORM + PostgreSQL
- **Mobile:** Capacitor (Android/iOS build pipeline)
- **Monorepo:** pnpm workspace
- **Push notifikacije:** OneSignal
- **Plaćanje:** Stripe (pretplate za muallime)
- **Email:** Zoho SMTP
- **File storage:** lokalni upload (prilozi, slika, audio)
- **H5P:** Interaktivni edukativni sadržaj (import/export .h5p)

---

## 1. Edukativni sadržaj (Kurikulum)

### Ilmihal — 231 lekcija u 3 nivoa
- **Nivo 1:** 85 lekcija — osnovi vjere, abdest, namaz, post, pet vremena namaza
- **Nivo 2:** 82 lekcije — produbljeni vjeronauk, život poslanika, islamski moral
- **Nivo 3:** 64 lekcije — napredni vjeronauk, tefsir, praktična primjena
- Svaka lekcija: HTML sadržaj, audio naracija, ugrađeni mini-kviz na kraju
- **Mapa puta:** Vizuelna interaktivna karta napredovanja kroz lekcije
- **Etape:** Skupovi lekcija koje se zaključuju završnim ispitom
- **Krunisanje:** Finalni ispit za cijeli nivo — nakon položenog otvara se sljedeći nivo
- **Medaljoni:** Nagrade za uspjeh na etapama i krunisanjima

### Čitaonica — životne priče poslanika
- 50+ priča kategorizovanih po temama (poslanici, ashabi, događaji)
- Audio naracija za svaku priču
- Ilustrovane stranice
- Admin editor za dodavanje nove priče

### Sufara (Arapsko pismo + tecvid)
- Interaktivna karta harfova (28 arapskih slova)
- Audio izgovor svakog harfa i harf-skupa
- Lekcije o pisanju i prepoznavanju
- Vježbe sa povratnom informacijom
- **Status:** aktivno razvijanje

### Banka pitanja — centralizovana baza znanja
- 1000+ pitanja razvrstanih po kategorijama
- Tipovi pitanja: jedan odgovor, više odgovora, tačno/lažno, poredaj, drag & drop, označi riječi
- Pitanja se preuzimaju iz banke i vezuju za kvizove
- Admin editor za kreiranje pitanja

### H5P sadržaj
- Uvoz .h5p paketa (interaktivni video, kartončići, poredaj, zagonetke)
- Serversko praćenje pokušaja i bodova
- Audit trail za svaki pokušaj

---

## 2. Gamifikacija i napredovanje

### Aferimi ⭐
- Bodovi za tačne odgovore u kvizovima
- Takmičenje sa drugim učenicima u tabeli

### Kapi meda 🍯
- **Postignuti rezultat** (ne valuta!) — učenik zarađuje kapi meda učeći lekcije i rješavajući kvizove
- S kapi meda **zarađuje vremenski kredit** za igrice
- Kapi meda ostaju kao **trajno postignuće** (nijedna se ne gubi)

### Saće grešaka (Popravi saće)
- Svi pogrešni odgovori iz kvizova se čuvaju
- Učenik kasnije može popraviti svaku grešku
- 5 kapi meda za svaku popravljenu grešku
- Alat za aktivno učenje, ne rote memorije

### Misije (dnevne i sedmične)
- "Pročitaj 3 lekcije", "Riješi kviz bez greške", "Popravi 5 grešaka"
- Završene misije donose dodatne nagrade

### Etape i krunisanje
- **Etapa:** Skup lekcija sa završnim ispitom
- **Krunisanje:** Finalni ispit za nivo — nakon uspješnog rješavanja otvara se sljedeći nivo
- Vizuelni medaljoni za svaki završeni korak

### Vremenski budžet za igrice
- Igrice nisu beskonačno dostupne
- Roditelj **prati** (ne kontrolira) koliko vremena dijete provodi u igricama
- Kada kredit istekne, učenik se vraća učenju da bi zaradio više

---

## 3. Edukativne igrice (8 igrica)

| Igrica | Opis |
|--------|------|
| **Pamti par** | Memory igrica za spajanje harfova i izgovora |
| **Brzi kviz** | Brzi pitanja i odgovori sa vremenskim ograničenjem |
| **Glavni gradovi** | Prepoznavanje glavnih gradova muslimanskih zemalja |
| **Zastave svijeta** | Prepoznavanje zastava |
| **Mektebsko saće** | Više-tipna pitanja sa pčelinjom tematikom |
| **Medena staza** | 8 kategorija pitanja (historija, moral, namaz, itd.) — anti-repeticija mehanizam |
| **Pčelin let** | Avantura igrica sa pitanjima i nagradama |
| **Tabela Aferima** | Rang lista učenika u grupi, mektebu i globalno |

---

## 4. Muallim (učitelj) — upravljački panel

### E-Dnevnik
- **Prisustvo:** Evidencija prisutnosti učenika po datumima
- **Ocjene:** Unos ocjena po kategorijama (vjeronauka, ponašanje, aktivnost)
- **Kalendar:** Plan lekcija, raspored, praznici
- **Zadaće:** Zadavanje zadaća grupi ili pojedinačnim učenicima
- **Poruke:** Direktna komunikacija sa roditeljima
- **Obavještenja:** Masovna obavještenja grupi

### Upravljanje grupama
- Kreiranje grupa (razreda)
- Dodavanje učenika u grupe
- Upravljanje licencama (pretplata)
- Štampanje kartica za prijavu učenika

### Izvještaji
- Pregled aktivnosti svih učenika
- Statistika kvizova (tačnost, progres)
- H5P interakcija i rezultati
- Napredovanje kroz nivoe

### Banka pitanja + Kviz editor
- Kreiranje pitanja u banci
- Sastavljanje kvizova od pitanja iz banke
- WYSIWYG editor za pitanja
- Reorder / drag & drop / true-false / multi-choice podrška

---

## 5. Roditelj — portal za praćenje

- **Pregled napretka:** Šta je dijete učilo, koliko je lekcija pročitalo, rezultati kvizova
- **Ocjene i prisustvo:** Školske ocjene i evidencija prisutnosti
- **Zadaće:** Koje zadaće ima dijete, do kad su rok
- **Kalendar:** Kada su nastave, ispiti, praznici
- **Poruke:** Direktna komunikacija sa muallimom
- **Tabela:** Usporedba rezultata djeteta sa ostalim učenicima
- **Vrijeme igranja:** Praćenje koliko vremena dijete provodi u igricama

---

## 6. Admin — super-administracija

- **Korisnici:** Upravljanje svim ulogama (admin, muallim, učenik, roditelj)
- **Sadržaj:** Editor za lekcije, kvizove, priče, pitanja
- **Upravljanje prilozima:** Slike, audio, video, PDF
- **Upload:** File upload za materijale (max 50MB)
- **Orphan uploads:** Čišćenje nekorištenih fajlova
- **Rječnik:** Glosar termina sa definicijama
- **Sistemsko zdravlje:** Health check rute
- **Analytics:** Pregled posjeta (IP, zemlja, grad, user agent)
- **Stripe:** Upravljanje pretplatama
- **Push:** Slanje push notifikacija
- **Content import:** Import sadržaja (bulk upload)

---

## 7. Baza podataka (PostgreSQL + Drizzle ORM)

### 7.1 Korisnici i institucije
| Tabela | Opis |
|--------|------|
| `users` | Korisnici (role: admin, muallim, učenik, roditelj) |
| `password_reset_tokens` | Tokeni za reset šifre |
| `mektebi` | Informacije o mektebima (škole) |
| `muallim_profili` | Profil muallima (licenca, škola, broj učenika) |
| `ucenik_profili` | Profil učenika (grupa, muallim, mekteb) |
| `roditelj_profili` | Profil roditelja |
| `roditelj_ucenik` | Veza roditelj → dijete (sa statusom odobrenja) |
| `grupe` | Razredi/grupe (raspored, naziv, muallim) |
| `pretplate` | Stripe pretplate i licence |
| `obavjestenja` | Školska i grupna obavještenja |

### 7.2 Edukativni sadržaj
| Tabela | Opis |
|--------|------|
| `ilmihal_lekcije` | 231 lekcija (HTML, audio, mini-kviz) |
| `kvizovi` | Kvizovi (naslovi, nivoi, slugs) |
| `pitanja_banka` | 1000+ pitanja (multi-type, kategorije) |
| `kviz_pitanja` | Veza kviz ↔ pitanje (many-to-many) |
| `knjige` | Priče za Čitaonicu |
| `kategorije_knjige` | Kategorije priča |
| `kviz_kategorije` | Kategorije pitanja |
| `prilozi` | Fajlovi, slike, audio, video (sa Hasanat vrijednošću) |
| `rjecnik` | Glosar termina |
| `h5p_pokusaji` | Pokušaji na H5P sadržaju |
| `embed_completions` | Praćenje završenih ugrađenih vježbi |
| `ocjene_sadrzaja` | Ocjene sadržaja (1-5 pčela) |
| `posjete` | Analytics (path, IP, zemlja, grad, user agent) |

### 7.3 Učenje i progres
| Tabela | Opis |
|--------|------|
| `korisnik_napredak` | Progres korisnika (bodovi, vrijeme, status) |
| `kviz_rezultati` | Rezultati kvizova (tačnost, %, bodovi) |
| `student_progress` | Progres nivoa 1 (Hasanat, Med, streak) |
| `exercise_sessions` | Sessioni vježbi za arapsko pismo |
| `medaljoni` | Definicije medaljona (checkpoints) |
| `student_medaljoni` | Koje medaljone učenik ima |
| `etapa_polaganja` | Pokušaji na etapama |
| `krunisanja` | Definicije krunisanja (finalnih ispita) |
| `krunisanje_lekcije` | Lekcije potrebne za krunisanje |
| `student_krunisanja` | Položena krunisanja |
| `pogresni_odgovori` | Pogrešni odgovori za Popravi saće |
| `misija_definicija` | Definicije misija |
| `misija_progress` | Progres misija po učeniku |
| `igra_pitanja` | Pitanja za Medena stazu |
| `medena_vidjena_pitanja` | Praćenje nedavno viđenih pitanja |

### 7.4 E-Dnevnik (školsko upravljanje)
| Tabela | Opis |
|--------|------|
| `prisustvo` | Prisustvo učenika |
| `ocjene` | Ocjene po kategorijama |
| `mekteb_kalendar` | Školski kalendar |
| `plan_lekcija` | Plan lekcija po grupama |
| `poruke` | Direktne poruke muallim ↔ roditelj |
| `zadace` | Zadaće za grupe |
| `zadace_ucenici` | Zadaće za pojedinačne učenike |
| `certifikati` | Izdatit certifikati |

### 7.5 Notifikacije
| Tabela | Opis |
|--------|------|
| `push_tokens` | OneSignal player ID-ovi za push notifikacije |

---

## 8. Statistika kodne baze

| Kategorija | Broj | Detalj |
|-----------|------|--------|
| **Frontend stranice** | 40+ | Home, Ilmihal, Kvizovi, Čitaonica, Igrice, Sufara, Admin, Login, Roditelj, Muallim, E-Dnevnik, Poruke, Profil, Vodič, ... |
| **Igrice** | 8 | Pamti par, Brzi kviz, Glavni gradovi, Zastave, Saće, Medena staza, Pčelin let, Tabela |
| **API rute** | 30+ | Auth, Content, Krunisanje, Misije, Muallim, Roditelj, Učenik, Poruke, Games, Ocjene, Progress, ... |
| **DB tabele** | 50+ | Korisnici, sadržaj, progres, e-dnevnik, notifikacije |
| **React komponenti** | 20+ | Layout, Maskota, Timer, Celebration modal, Pčela rating, LekcijaPicker, H5P player, ... |
| **i18n jezici** | 3 | Bosanski (default), Hrvatski, Engleski |
| **Kvizova** | 43+ | Po lekcijama i nivoima |
| **Lekcija** | 231 | U 3 nivoa |
| **Priča** | 50+ | U Čitaonici |

---

## 9. API rute (pregled)

### Autentifikacija
- `POST /api/auth/register` — Registracija učenika / roditelja / muallima
- `POST /api/auth/login` — Prijava
- `POST /api/auth/change-password` — Promjena šifre
- `POST /api/auth/zaboravljena-sifra` — Reset šifre (email)
- `GET /api/auth/me` — Trenutni korisnik

### Sadržaj
- `GET /api/content/ilmihal` — Sve lekcije
- `GET /api/content/ilmihal/:slug` — Jedna lekcija
- `GET /api/content/kvizovi` — Svi kvizovi
- `GET /api/content/kviz/:slug` — Jedan kviz
- `GET /api/content/knjige` — Priče
- `GET /api/content/kategorije-knjiga` — Kategorije priča
- `GET /api/content/rjecnik` — Rječnik

### Progres i gamifikacija
- `GET /api/progress` — Progres učenika
- `GET /api/misije` — Aktivne misije
- `POST /api/misije/:id/complete` — Završi misiju
- `GET /api/popravi-sace` — Pogrešni odgovori
- `POST /api/popravi-sace/:id` — Popravi grešku
- `GET /api/krunisanja/nivo/:nivo` — Status krunisanja
- `GET /api/etape` — Etape i medaljoni
- `GET /api/mapa/nivo/:nivo` — Mapa puta

### Igrice
- `GET /api/games/credits` — Kapi meda i vremenski kredit
- `POST /api/games/:game/play` — Započni igricu
- `POST /api/games/:game/result` — Spremi rezultat

### Muallim (zaštićeno)
- `GET /api/muallim/dashboard` — Dashboard
- `GET /api/muallim/grupe` — Grupe
- `POST /api/muallim/grupe` — Nova grupa
- `GET /api/muallim/ucenici` — Učenici
- `POST /api/muallim/prisustvo` — Evidencija prisustva
- `POST /api/muallim/ocjene` — Unos ocjena
- `POST /api/muallim/zadace` — Zadavanje zadaće
- `GET /api/muallim/poruke` — Poruke
- `POST /api/muallim/obavjestenja` — Obavještenja

### Roditelj (zaštićeno)
- `GET /api/roditelj/dashboard` — Dashboard
- `GET /api/roditelj/ucenici` — Djeca
- `GET /api/roditelj/progress/:id` — Progres djeteta
- `GET /api/roditelj/poruke` — Poruke

### Admin (zaštićeno)
- `GET /api/admin/users` — Svi korisnici
- `GET /api/admin/stats` — Statistika
- `POST /api/admin/content/import` — Import sadržaja
- `GET /api/admin/prilozi` — Prilozi
- `POST /api/upload` — File upload
- `GET /api/health` — System health

### Poruke
- `GET /api/poruke` — Inbox
- `POST /api/poruke` — Pošalji poruku
- `GET /api/poruke/unread-count` — Nepročitane

---

## 10. Deployment

- **Web:** Replit deployment (mekteb.net)
- **Mobile:** Capacitor build (Android/iOS)
- **API:** Express server na Replit
- **DB:** Replit PostgreSQL
- **CDN:** Slike i audio preko `/api/uploads/`

---

## 11. Licenca

MIT License — © Mekteb.net

---

*Za detaljniju tehničku dokumentaciju (API spec, DB schema, komponente), pogledajte `replit.md`.*
