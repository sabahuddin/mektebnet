# 📋 REPLIT SPECIFIKACIJA — Arapski harfovi: Interaktivna platforma za djecu

> **Za Replit AI agenta**: Ovo je kompletan tehnički plan. Gradi tačno ono što je opisano, redom kojim je opisano. Nemoj improvizirati arhitekturu — prati ovu strukturu.

---

## 🎯 Šta gradimo

**Naziv aplikacije**: Harfovi (ili: Moj Mushaf)

Interaktivna web aplikacija za djecu (7–12 godina) za učenje arapskih slova (harfova) s ciljem da djeca mogu čitati Kur'an. Aplikacija je na **bosanskom jeziku**. Arapski tekst mora biti ispravno renderiran (desno na lijevo, RTL).

**Primarni uređaj**: mobilni telefon (portrait mode)
**Sekundarni**: tablet i desktop

---

## 🛠️ Tech Stack

```
Framework:     React (Vite)
Styling:       Tailwind CSS
Animacije:     Framer Motion
Audio:         Howler.js
Routing:       React Router v6
State:         React Context + useReducer
Perzistencija: localStorage (nema backenda u MVP)
Fontovi:       Google Fonts — Amiri (arapski), Nunito (bosanski UI)
```

### Instalacija zavisnosti

```bash
npm create vite@latest harfovi -- --template react
cd harfovi
npm install
npm install framer-motion
npm install howler
npm install react-router-dom
npm install tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### tailwind.config.js

```js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        arabic: ["Amiri", "serif"],
        ui: ["Nunito", "sans-serif"],
      },
      colors: {
        primary: "#1B4332",
        secondary: "#D4A017",
        accent: "#F0E6C8",
        success: "#52B788",
        error: "#E63946",
        bg: "#FDFBF7",
      },
    },
  },
};
```

### index.html — dodaj u `<head>`

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />
```

---

## 📁 Struktura projekta

```
src/
├── main.jsx
├── App.jsx
├── index.css
│
├── data/
│   ├── harfovi.js          ← Svi podaci o harfovima
│   └── lekcije.js          ← Plan lekcija
│
├── context/
│   └── NapredakContext.jsx ← Globalni state napretka
│
├── hooks/
│   └── useAudio.js         ← Audio hook
│
├── pages/
│   ├── Pocetna.jsx         ← Naslovna/home
│   ├── KartaHarfova.jsx    ← Pregled svih harfova
│   ├── Lekcija.jsx         ← Wrapper za lekciju
│   └── Nagrada.jsx         ← Ekran nagrade nakon lekcije
│
├── components/
│   ├── layout/
│   │   ├── NavigacijaBar.jsx
│   │   └── ProgressBar.jsx
│   │
│   ├── lekcija/
│   │   ├── UvodHarf.jsx        ← Prezentacija harfa
│   │   ├── PozicijeHarfa.jsx   ← Harf na početku/sredini/kraju
│   │   └── NagradaEkran.jsx
│   │
│   └── vjezbe/
│       ├── VjezbaFlash.jsx         ← Tip 1: 4 odgovora
│       ├── VjezbaSlušanje.jsx      ← Tip 2: Čuj i klikni
│       ├── VjezbaPronadi.jsx       ← Tip 3: Pronađi harf
│       ├── VjezbaSortiranje.jsx    ← Tip 4: Drag & Drop
│       └── VjezbaTapper.jsx        ← Tip 7: Brzinska igra
│
└── utils/
    ├── zvjezdice.js        ← Logika bodovanja
    └── randomizer.js       ← Miješanje opcija
```

---

## 📊 Podaci — `src/data/harfovi.js`

Ovo je centralna baza svih harfova. Svaki harf ima:

```js
export const HARFOVI = [
  {
    id: 1,
    harf: "ب",
    ime: "Ba",
    transliteracija: "b",
    izgovor_opis: "Kao naše slovo B",
    tackice: 1,
    tackice_pozicija: "ispod",
    oblik_grupa: "ba_grupa", // isti osnovni oblik
    audio: "ba.mp3",
    audio_fatha: "ba_fatha.mp3",   // بَ
    audio_kesra: "ba_kesra.mp3",   // بِ
    audio_damma: "ba_damma.mp3",   // بُ
    harf_fatha: "بَ",
    harf_kesra: "بِ",
    harf_damma: "بُ",
    pozicija_pocetak: "بـ",
    pozicija_sredina: "ـبـ",
    pozicija_kraj: "ـب",
    redoslijed_ucenja: 1,
    grupa_lekcije: 1,
  },
  {
    id: 2,
    harf: "ن",
    ime: "Nun",
    transliteracija: "n",
    izgovor_opis: "Kao naše slovo N",
    tackice: 1,
    tackice_pozicija: "iznad",
    oblik_grupa: "ba_grupa",
    audio: "nun.mp3",
    audio_fatha: "nun_fatha.mp3",
    audio_kesra: "nun_kesra.mp3",
    audio_damma: "nun_damma.mp3",
    harf_fatha: "نَ",
    harf_kesra: "نِ",
    harf_damma: "نُ",
    pozicija_pocetak: "نـ",
    pozicija_sredina: "ـنـ",
    pozicija_kraj: "ـن",
    redoslijed_ucenja: 2,
    grupa_lekcije: 1,
  },
  {
    id: 3,
    harf: "ت",
    ime: "Ta",
    transliteracija: "t",
    izgovor_opis: "Kao naše slovo T",
    tackice: 2,
    tackice_pozicija: "iznad",
    oblik_grupa: "ba_grupa",
    audio: "ta.mp3",
    audio_fatha: "ta_fatha.mp3",
    audio_kesra: "ta_kesra.mp3",
    audio_damma: "ta_damma.mp3",
    harf_fatha: "تَ",
    harf_kesra: "تِ",
    harf_damma: "تُ",
    pozicija_pocetak: "تـ",
    pozicija_sredina: "ـتـ",
    pozicija_kraj: "ـت",
    redoslijed_ucenja: 3,
    grupa_lekcije: 1,
  },
  {
    id: 4,
    harf: "ث",
    ime: "Sa",
    transliteracija: "ṯ",
    izgovor_opis: "Između S i TH (engleski 'think')",
    tackice: 3,
    tackice_pozicija: "iznad",
    oblik_grupa: "ba_grupa",
    audio: "sa.mp3",
    audio_fatha: "sa_fatha.mp3",
    audio_kesra: "sa_kesra.mp3",
    audio_damma: "sa_damma.mp3",
    harf_fatha: "ثَ",
    harf_kesra: "ثِ",
    harf_damma: "ثُ",
    pozicija_pocetak: "ثـ",
    pozicija_sredina: "ـثـ",
    pozicija_kraj: "ـث",
    redoslijed_ucenja: 4,
    grupa_lekcije: 1,
  },
  // ... NASTAVI ZA SVE 28 HARFOVA ISTIM OBRASCEM
  // Redoslijed učenja prati pedagoški plan:
  // Grupa 1: ب ن ت ث
  // Grupa 2: ا و ر ز
  // Grupa 3: ج ح خ
  // Grupa 4: د ذ
  // Grupa 5: س ش
  // Grupa 6: ص ض
  // Grupa 7: ط ظ
  // Grupa 8: ع غ
  // Grupa 9: ف ق
  // Grupa 10: ك ل م
  // Grupa 11: ه ء ي
];

// Audio fajlovi: staviti u /public/audio/
// Format naziva: [transliteracija].mp3, [transliteracija]_fatha.mp3, itd.
// Ako nemaš audio fajlove, koristi Web Speech API kao fallback (vidi useAudio.js)
```

---

## 📚 Lekcije — `src/data/lekcije.js`

```js
export const LEKCIJE = [
  {
    id: 1,
    naziv: "Harfovi koji se drže za ruke",
    opis: "Upoznaj ب ن ت ث — četiri harfa, isti oblik, različite tačkice",
    harfovi_ids: [1, 2, 3, 4], // id-evi iz HARFOVI
    ikona: "🤝",
    boja: "#52B788",
    vjezbe: [
      { tip: "uvod", harf_id: 1 },
      { tip: "uvod", harf_id: 2 },
      { tip: "flash", harfovi: [1, 2, 3, 4], pitanja: 8 },
      { tip: "uvod", harf_id: 3 },
      { tip: "uvod", harf_id: 4 },
      { tip: "flash", harfovi: [1, 2, 3, 4], pitanja: 8 },
      { tip: "pronadi", harf_id: 1, ukupno_harfova: [1,2,3,4] },
      { tip: "pronadi", harf_id: 3, ukupno_harfova: [1,2,3,4] },
      { tip: "slusanje", harfovi: [1, 2, 3, 4], pitanja: 6 },
    ],
    max_zvjezdice: 3,
  },
  {
    id: 2,
    naziv: "Harfovi koji stoje sami",
    opis: "ا و ر ز — ovi harfovi se ne spajaju s lijeve strane",
    harfovi_ids: [5, 6, 7, 8], // alif, vav, ra, zaj
    ikona: "🧍",
    boja: "#D4A017",
    vjezbe: [
      { tip: "uvod", harf_id: 5 },
      { tip: "uvod", harf_id: 6 },
      { tip: "flash", harfovi: [5, 6, 7, 8, 1, 2], pitanja: 8 }, // + ponavljanje starih
      { tip: "uvod", harf_id: 7 },
      { tip: "uvod", harf_id: 8 },
      { tip: "flash", harfovi: [5, 6, 7, 8, 1, 2, 3, 4], pitanja: 10 },
      { tip: "pronadi", harf_id: 5, ukupno_harfova: [1,2,3,4,5,6,7,8] },
      { tip: "slusanje", harfovi: [5, 6, 7, 8], pitanja: 6 },
      { tip: "tapper", harfovi: [1,2,3,4,5,6,7,8], trajanje_sec: 30 },
    ],
    max_zvjezdice: 3,
  },
  // ... ostatak lekcija istim obrascem
];
```

---

## 🌐 State — `src/context/NapredakContext.jsx`

```jsx
import { createContext, useContext, useReducer, useEffect } from "react";

const POCETNI_STATE = {
  korisnik_ime: "",
  zavrsene_lekcije: [],      // [1, 2, 3, ...]
  zvjezdice_po_lekciji: {},  // { 1: 3, 2: 2, ... }
  nauceni_harfovi: [],       // [1, 2, 3, ...]
  streak_dani: 0,
  zadnji_pristup: null,
  ukupne_zvjezdice: 0,
};

function reducer(state, action) {
  switch (action.type) {
    case "POSTAVI_IME":
      return { ...state, korisnik_ime: action.ime };

    case "ZAVRSI_LEKCIJU":
      const noviNauceni = [
        ...new Set([...state.nauceni_harfovi, ...action.harfovi_ids]),
      ];
      const novaLekcija = !state.zavrsene_lekcije.includes(action.lekcija_id);
      return {
        ...state,
        zavrsene_lekcije: novaLekcija
          ? [...state.zavrsene_lekcije, action.lekcija_id]
          : state.zavrsene_lekcije,
        zvjezdice_po_lekciji: {
          ...state.zvjezdice_po_lekciji,
          [action.lekcija_id]: Math.max(
            state.zvjezdice_po_lekciji[action.lekcija_id] || 0,
            action.zvjezdice
          ),
        },
        nauceni_harfovi: noviNauceni,
        ukupne_zvjezdice: state.ukupne_zvjezdice + action.zvjezdice,
      };

    case "AZURIRAJ_STREAK":
      return { ...state, streak_dani: action.streak, zadnji_pristup: new Date().toDateString() };

    default:
      return state;
  }
}

const NapredakContext = createContext();

export function NapredakProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, POCETNI_STATE, () => {
    const saved = localStorage.getItem("harfovi_napredak");
    return saved ? JSON.parse(saved) : POCETNI_STATE;
  });

  useEffect(() => {
    localStorage.setItem("harfovi_napredak", JSON.stringify(state));
  }, [state]);

  return (
    <NapredakContext.Provider value={{ state, dispatch }}>
      {children}
    </NapredakContext.Provider>
  );
}

export const useNapredak = () => useContext(NapredakContext);
```

---

## 🔊 Audio — `src/hooks/useAudio.js`

```js
import { useRef, useCallback } from "react";

export function useAudio() {
  const audioRef = useRef(null);

  const reproduciraj = useCallback((src) => {
    // Pokušaj s pravim audio fajlom
    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(`/audio/${src}`);
      audioRef.current.play().catch(() => {
        // Fallback: Web Speech API
        govoriFallback(src);
      });
    } catch {
      govoriFallback(src);
    }
  }, []);

  function govoriFallback(src) {
    // Izvuci ime harfa iz naziva fajla (npr. "ba.mp3" → "ba")
    const tekst = src.replace(".mp3", "").replace("_fatha", "").replace("_kesra", "").replace("_damma", "");
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(tekst);
      utterance.lang = "ar-SA";
      utterance.rate = 0.7;
      window.speechSynthesis.speak(utterance);
    }
  }

  const zaustavi = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    window.speechSynthesis?.cancel();
  }, []);

  return { reproduciraj, zaustavi };
}
```

---

## 📄 Stranice (Pages)

### `src/pages/Pocetna.jsx`

Naslovna stranica. Prikazuje:

```
┌─────────────────────────────────────┐
│  🌙 Harfovi                         │
│  "Nauči čitati Kur'an"              │
│                                     │
│  [Veliki arapski harf koji se       │
│   animirano mijenja svake 3s]       │
│                                     │
│  ═══════════════════                │
│  Zdravo, Ahmed! 👋                  │
│  🔥 5 dana zaredom                  │
│  ⭐ 47 zvjezdica                    │
│  ═══════════════════                │
│                                     │
│  [NASTAVI UČENJE]  ← big green btn │
│  [Karta harfova]                    │
└─────────────────────────────────────┘
```

- Ako nema korisničkog imena → prikaži modal za unos imena
- "Nastavi učenje" vodi na prvu nezavršenu lekciju
- Provjeri streak pri svakom otvaranju

---

### `src/pages/KartaHarfova.jsx`

Pregled svih 28 harfova u grid formatu:

```
┌─────────────────────────────────────┐
│  ← Moja karta harfova               │
│                                     │
│  ✅ب  ✅ت  ✅ث  ✅ن  🔓ي  🔒ا     │
│  🔒و  🔒ر  🔒ز  🔒ج  🔒ح  🔒خ    │
│  ... (svih 28)                      │
│                                     │
│  Klik na ✅ harf → detalji          │
│  Klik na 🔒 harf → "Još nisi       │
│  naučio/la ovaj harf"               │
│                                     │
│  [10/28 harfova] ████░░░░░ 36%      │
└─────────────────────────────────────┘
```

Status ikonice:
- 🔒 Zaključan (lekcija nije dostupna)
- 🔓 Dostupan (lekcija dostupna, nije završena)
- ✅ Naučen (lekcija završena)

---

### `src/pages/Lekcija.jsx`

Ovo je **orchestrator** — upravlja tokom lekcije.

```jsx
// Pseudokod logike
function Lekcija() {
  const [korakIndex, setKorakIndex] = useState(0);
  const [zvjezdice, setZvjezdice] = useState(0);
  const [tocni, setTocni] = useState(0);
  const [netocni, setNetocni] = useState(0);

  const lekcija = LEKCIJE[id]; // iz URL params
  const korak = lekcija.vjezbe[korakIndex];

  // Reneriraj odgovarajuću komponentu za tip koraka
  function renderKorak() {
    switch(korak.tip) {
      case "uvod":    return <UvodHarf harf_id={korak.harf_id} onDalje={sljedeciKorak} />;
      case "flash":   return <VjezbaFlash {...korak} onZavrsi={sljedeciKorak} />;
      case "pronadi": return <VjezbaPronadi {...korak} onZavrsi={sljedeciKorak} />;
      case "slusanje":return <VjezbaSlušanje {...korak} onZavrsi={sljedeciKorak} />;
      case "tapper":  return <VjezbaTapper {...korak} onZavrsi={sljedeciKorak} />;
    }
  }

  // Na kraju svih koraka → Nagrada ekran
  if (korakIndex >= lekcija.vjezbe.length) {
    return <NagradaEkran zvjezdice={zvjezdice} lekcija={lekcija} />;
  }

  return (
    <div>
      <ProgressBar trenutni={korakIndex} ukupno={lekcija.vjezbe.length} />
      <AnimatePresence mode="wait">
        <motion.div key={korakIndex}>
          {renderKorak()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

---

## 🧩 Komponente vježbi — Detaljna specifikacija

### 1. `UvodHarf.jsx` — Prezentacija harfa

**Izgled:**
```
┌─────────────────────────────────────┐
│                                     │
│  Upoznaj harf:                      │
│                                     │
│         ب         ← velik, centiran │
│       "Ba"                          │
│  "Kao naše slovo B"                 │
│                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │  بَ  │ │  بِ  │ │  بُ  │        │
│  │  BA  │ │  BI  │ │  BU  │        │
│  └──────┘ └──────┘ └──────┘        │
│  🔊tap    🔊tap    🔊tap            │
│                                     │
│  Pozicije u riječi:                 │
│  Početak: بـ                        │
│  Sredina: ـبـ                       │
│  Kraj:    ـب                        │
│                                     │
│         [RAZUMIJEM →]               │
└─────────────────────────────────────┘
```

**Ponašanje:**
- Harf se animirano pojavljuje (scale + fade in) uz zvuk
- Svaka kartica (bَ bِ bُ) je tapable → reproducira audio
- Pozicije su prikazane s blagom animacijom
- Dugme "Razumijem" tek nakon 3 sekunde (da dijete zaista pogleda)

---

### 2. `VjezbaFlash.jsx` — 4 odgovora

**Props:** `{ harfovi: [1,2,3,4], pitanja: 8, onZavrsi: fn }`

**Izgled:**
```
┌─────────────────────────────────────┐
│  Pitanje 3/8              ⭐ 2      │
│                                     │
│  Koji je ovo harf?                  │
│                                     │
│         خ          ← RTL font       │
│                                     │
│  ┌────────┐  ┌────────┐            │
│  │   ح    │  │   خ    │            │
│  └────────┘  └────────┘            │
│  ┌────────┐  ┌────────┐            │
│  │   ج    │  │   ه    │            │
│  └────────┘  └────────┘            │
└─────────────────────────────────────┘
```

**Logika:**
```js
// Generiraj pitanje
function generisiPitanje(harfovi, sviHarfovi) {
  const tacniHarf = harfovi[Math.floor(Math.random() * harfovi.length)];
  const netacni = sviHarfovi
    .filter(h => h.id !== tacniHarf.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const opcije = [...netacni, tacniHarf].sort(() => Math.random() - 0.5);
  return { tacniHarf, opcije };
}
```

**Feedback:**
- Tačan odgovor: kartica postane zelena, zvuk "ding", kratka animacija zvjezdice
- Netačan: kartica postane crvena, kratko potresanje (shake animation), tačan odgovor se pokaže zelenim
- Nakon feedbacka (1.5s) → automatski sljedeće pitanje
- Na kraju 8 pitanja → poziva `onZavrsi({ tocni, netocni })`

---

### 3. `VjezbaSlušanje.jsx` — Čuj i klikni

**Props:** `{ harfovi: [1,2,3,4], pitanja: 6, onZavrsi: fn }`

**Izgled:**
```
┌─────────────────────────────────────┐
│  Pitanje 2/6                        │
│                                     │
│  Koji harf čuješ?                   │
│                                     │
│  ┌─────────────────────────────┐    │
│  │   🔊  SLUŠAJ                │    │
│  │   [tapni za reprodukciju]   │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌──────┐  ┌──────┐                │
│  │  ب   │  │  ن   │                │
│  └──────┘  └──────┘                │
│  ┌──────┐  ┌──────┐                │
│  │  ت   │  │  ث   │                │
│  └──────┘  └──────┘                │
└─────────────────────────────────────┘
```

**Ponašanje:**
- Audio se automatski reproducira pri ulasku u pitanje
- Dugme 🔊 ponavlja audio (može tapnuti više puta)
- Odabir kartice → feedback kao u VjezbaFlash

---

### 4. `VjezbaPronadi.jsx` — Pronađi sve harfove

**Props:** `{ harf_id: 1, ukupno_harfova: [1,2,3,4], onZavrsi: fn }`

**Izgled:**
```
┌─────────────────────────────────────┐
│  Pronađi sve harfove:  ب            │
│  Pronađeno: 3/6     ⏱️ 00:45        │
│                                     │
│  ب ن م ت ب ث ن ب ت م               │
│  م ت ب ث ن ب م ت ن ب               │
│  ث م ن ت ب م ث ن ب ت               │
│                                     │
│  (svaki harf je zasebno tapabilan)  │
└─────────────────────────────────────┘
```

**Logika:**
```js
// Generiraj grid
function generisiGrid(ciljniHarf, ostaliHarfovi, ukupno = 30) {
  const ciljnih = 6; // Skriveno 6 ciljnih harfova
  const grid = [];
  for (let i = 0; i < ciljnih; i++) grid.push({ harf: ciljniHarf, isCilj: true, tapnut: false });
  for (let i = 0; i < ukupno - ciljnih; i++) {
    const slucajni = ostaliHarfovi[Math.floor(Math.random() * ostaliHarfovi.length)];
    grid.push({ harf: slucajni, isCilj: false, tapnut: false });
  }
  return grid.sort(() => Math.random() - 0.5);
}
```

**Ponašanje:**
- Tačan tap → harf postaje zeleni s kvačicom ✅
- Netačan tap → kratko tresenje harfa
- Kad se pronađe svih 6 → animacija slave, poziva `onZavrsi`
- Bonus zvjezdica za brže pronalaženje

---

### 5. `VjezbaTapper.jsx` — Brzinska igra

**Props:** `{ harfovi: [1,...,8], trajanje_sec: 30, onZavrsi: fn }`

**Izgled:**
```
┌─────────────────────────────────────┐
│  Tapni svaki: ب          ⏱️ 0:23   │
│  ❤️❤️❤️          Tačno: 12         │
│                                     │
│           ن   ← pada               │
│                    ب   ← tapni!    │
│      م                             │
│                 ت                  │
│  ═══════════════════════════════   │
│  (harfovi padaju, taptaš tačne)    │
└─────────────────────────────────────┘
```

**Logika:**
```js
// State
const [padajuci, setPadajuci] = useState([]); // [{id, harf, x, y, speed}]
const [zivoti, setZivoti] = useState(3);
const [score, setScore] = useState(0);
const [vrijemePreostalo, setVrijemePreostalo] = useState(trajanje_sec);

// Svake 1.5s dodaj novi harf koji pada
// Harf pada od vrha do dna (CSS animation translateY)
// Ako dođe do dna bez tapa → gubi se život
// Tap na tačni harf → +10 poena, animacija slave
// Tap na pogrešni harf → -1 život, crveni flash
// Kad istekne vrijeme ili se izgube svi životi → onZavrsi(score)
```

---

## 🏆 `NagradaEkran.jsx`

Prikazuje se na kraju lekcije:

```
┌─────────────────────────────────────┐
│                                     │
│         🎉 Sjajno! 🎉               │
│                                     │
│    Završio/la si lekciju:           │
│    "Harfovi koji se drže za ruke"   │
│                                     │
│         ⭐ ⭐ ⭐                     │
│      (animirano padaju)             │
│                                     │
│    Naučio/la si:                    │
│    ب   ن   ت   ث                   │
│    (harfovi se animirano pojavljuju)│
│                                     │
│  [NASTAVI →]   [Karta harfova]      │
│                                     │
└─────────────────────────────────────┘
```

**Računanje zvjezdica:**
```js
function izracunajZvjezdice(tocni, netocni, ukupno) {
  const postotak = tocni / ukupno;
  if (postotak >= 0.9) return 3;
  if (postotak >= 0.7) return 2;
  return 1;
}
```

---

## 🎨 Dizajn sistem

### Boje
```css
:root {
  --boja-primarna: #1B4332;    /* tamno zelena — islamska */
  --boja-sekundarna: #D4A017;  /* zlatna — zvjezdice */
  --boja-pozadina: #FDFBF7;   /* topla bijela */
  --boja-akcenat: #F0E6C8;    /* blag krem */
  --boja-uspjeh: #52B788;     /* svijetlo zelena */
  --boja-greska: #E63946;     /* crvena */
  --boja-kartica: #FFFFFF;
  --sjena: 0 4px 20px rgba(0,0,0,0.08);
}
```

### Arapski tekst — OBAVEZNO
```css
.arapski {
  font-family: "Amiri", serif;
  direction: rtl;
  unicode-bidi: bidi-override;
  font-size: 2.5rem;    /* ili veći za izolovane harfove */
  line-height: 1.8;
  color: var(--boja-primarna);
}

/* Za veliki izolovani harf (UvodHarf) */
.harf-veliki {
  font-size: 6rem;
  line-height: 1.2;
}
```

### Animacije (Framer Motion)
```js
// Ulaz ekrana
const ekranVariants = {
  initial: { opacity: 0, x: 50 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -50 },
  transition: { duration: 0.3 }
};

// Tačan odgovor
const tacnoVariants = {
  initial: { scale: 1 },
  animate: { scale: [1, 1.2, 1], backgroundColor: "#52B788" },
  transition: { duration: 0.4 }
};

// Netačan odgovor (shake)
const netacnoVariants = {
  animate: {
    x: [-8, 8, -8, 8, 0],
    backgroundColor: "#E63946"
  },
  transition: { duration: 0.4 }
};

// Zvjezdice padaju
const zvjezdicaVariants = {
  initial: { y: -50, opacity: 0, rotate: 0 },
  animate: { y: 0, opacity: 1, rotate: 360 },
  transition: { type: "spring", bounce: 0.6 }
};
```

---

## 🔧 App.jsx — Routing

```jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { NapredakProvider } from "./context/NapredakContext";
import Pocetna from "./pages/Pocetna";
import KartaHarfova from "./pages/KartaHarfova";
import Lekcija from "./pages/Lekcija";

export default function App() {
  return (
    <NapredakProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-[#FDFBF7] font-ui max-w-md mx-auto">
          <Routes>
            <Route path="/" element={<Pocetna />} />
            <Route path="/karta" element={<KartaHarfova />} />
            <Route path="/lekcija/:id" element={<Lekcija />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </BrowserRouter>
    </NapredakProvider>
  );
}
```

---

## ✅ Redoslijed gradnje (za Replit)

Gradi u ovom redoslijedu — svaki korak mora raditi prije sljedećeg:

1. **[ ] Setup** — Vite + React + Tailwind + Framer Motion + React Router
2. **[ ] `harfovi.js`** — Unesi sve podatke za prvu grupu (ب ن ت ث)
3. **[ ] `NapredakContext.jsx`** — State management + localStorage
4. **[ ] `useAudio.js`** — Audio hook (s Web Speech API fallbackom)
5. **[ ] `App.jsx`** — Routing
6. **[ ] `Pocetna.jsx`** — Naslovna stranica
7. **[ ] `UvodHarf.jsx`** — Prezentacija jednog harfa
8. **[ ] `VjezbaFlash.jsx`** — Flash kartica s 4 odgovora
9. **[ ] `VjezbaSlušanje.jsx`** — Slušanje i klik
10. **[ ] `VjezbaPronadi.jsx`** — Pronađi harf u gridu
11. **[ ] `Lekcija.jsx`** — Orchestrator (spaja sve vježbe)
12. **[ ] `NagradaEkran.jsx`** — Završni ekran s nagradama
13. **[ ] `KartaHarfova.jsx`** — Pregled svih harfova
14. **[ ] `VjezbaTapper.jsx`** — Brzinska igra (ostaviti za kraj)
15. **[ ] Preostali harfovi** — Unesi svih 28 harfova u `harfovi.js`
16. **[ ] Preostale lekcije** — Unesi sve grupe u `lekcije.js`

---

## ⚠️ Važne napomene za Replit

- **Arapski tekst mora biti ispravno renderiran** — uvijek koristi `dir="rtl"` na elementima koji sadrže arapski tekst
- **Mobilni first** — sve komponente trebaju raditi na ekranu 375px širine
- **Nema backenda** — sve se čuva u `localStorage`
- **Audio fallback** — ako `.mp3` fajlovi ne postoje, koristi Web Speech API s `lang="ar-SA"`
- **Framer Motion AnimatePresence** — obavezno za tranzicije između vježbi
- **Harfovi font size** — izolovani harfovi minimum `4rem`, u karticama `2.5rem`, u gridu `1.8rem`
- **Boje kartica za odgovore** — defaultno bijele s primaryom za border, zelene za tačno, crvene za netačno
- Sve bosanske UI poruke koristiti, arapski samo za harfove

---

## 🚀 Minimalni funkcionalni prototip (MVP)

Ako je potrebno brzo testirati, napravi samo ovo:
1. Jedna lekcija (ب ن ت ث)
2. UvodHarf za sva 4 harfa
3. VjezbaFlash (8 pitanja)
4. NagradaEkran
5. Naslovna stranica s gumbom "Počni"

To je dovoljno da se vidi da li koncept funkcionira.
