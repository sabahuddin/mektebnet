// Inline SVG ilustracije za 4 koraka u H5P uputstvu.
// Inline (a ne kao spoljni .svg fajlovi) zato što:
//  - eliminiše HTTP request, cache i MIME probleme
//  - SVG putuje sa stranicom, nema flash-a praznog okvira
//  - Playwright e2e testovi pouzdano vide renderovan sadržaj
//
// Svaka ilustracija je čista SVG sa samo ASCII karakterima u text node-ovima
// (bos. dijakritika izostavljena namjerno — SVG text rendering u nekim
// headless browser-ima ima čudne probleme sa multi-byte u <text>).
//
// Reference: prethodne verzije sa korak-N.svg fajlovima imale su problem da
// step-4.svg ne učita pouzdano u Playwright-u, dok je u common Chromium-u radio.

import type { ReactNode } from "react";

function Frame({ children, viewBox }: { children: ReactNode; viewBox: string }) {
  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-blue-100 bg-gradient-to-br from-slate-50 to-blue-50">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={viewBox}
        role="img"
        className="w-full h-auto block"
        preserveAspectRatio="xMidYMid meet"
      >
        {children}
      </svg>
    </div>
  );
}

export function Step1Illustration() {
  return (
    <Frame viewBox="0 0 800 280">
      <title>Korak 1: preuzmi Lumi za svoj operativni sistem</title>
      <defs>
        <linearGradient id="s1bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eff6ff" />
          <stop offset="100%" stopColor="#e0e7ff" />
        </linearGradient>
        <linearGradient id="s1btn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="800" height="280" fill="url(#s1bg)" />
      <rect x="60" y="40" width="680" height="200" rx="14" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
      <rect x="60" y="40" width="680" height="34" rx="14" fill="#f1f5f9" />
      <circle cx="84" cy="57" r="6" fill="#ef4444" />
      <circle cx="106" cy="57" r="6" fill="#f59e0b" />
      <circle cx="128" cy="57" r="6" fill="#22c55e" />
      <rect x="160" y="48" width="500" height="18" rx="9" fill="#ffffff" stroke="#e2e8f0" />
      <text x="180" y="62" fontFamily="ui-monospace,Menlo,monospace" fontSize="13" fill="#64748b">https://lumi.education/</text>
      <circle cx="120" cy="135" r="32" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" />
      <text x="120" y="142" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="26" fontWeight="800" fill="#b45309">L</text>
      <text x="170" y="125" fontFamily="system-ui,sans-serif" fontSize="22" fontWeight="800" fill="#0f172a">Lumi Education</text>
      <text x="170" y="148" fontFamily="system-ui,sans-serif" fontSize="13" fill="#64748b">Besplatna desktop aplikacija za H5P</text>
      <g transform="translate(170,170)">
        <rect width="140" height="40" rx="10" fill="url(#s1btn)" />
        <text x="70" y="26" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#ffffff">Windows</text>
      </g>
      <g transform="translate(325,170)">
        <rect width="140" height="40" rx="10" fill="url(#s1btn)" />
        <text x="70" y="26" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#ffffff">macOS</text>
      </g>
      <g transform="translate(480,170)">
        <rect width="140" height="40" rx="10" fill="url(#s1btn)" />
        <text x="70" y="26" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#ffffff">Linux</text>
      </g>
      <text x="400" y="265" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="11" fill="#64748b" fontStyle="italic">Korak 1: preuzmi Lumi za svoj operativni sistem</text>
    </Frame>
  );
}

export function Step2Illustration() {
  return (
    <Frame viewBox="0 0 800 320">
      <title>Korak 2: biblioteka H5P tipova vjezbi</title>
      <defs>
        <linearGradient id="s2bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0fdfa" />
          <stop offset="100%" stopColor="#ccfbf1" />
        </linearGradient>
      </defs>
      <rect width="800" height="320" fill="url(#s2bg)" />
      <rect x="40" y="30" width="720" height="260" rx="14" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
      <rect x="40" y="30" width="720" height="32" rx="14" fill="#f8fafc" />
      <text x="60" y="52" fontFamily="system-ui,sans-serif" fontSize="13" fontWeight="700" fill="#0f172a">Lumi - H5P Editor</text>
      <text x="60" y="92" fontFamily="system-ui,sans-serif" fontSize="14" fontWeight="700" fill="#0f172a">Izaberi tip vjezbe:</text>

      <g transform="translate(60,110)">
        <rect width="200" height="70" rx="10" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" />
        <circle cx="22" cy="35" r="14" fill="#f59e0b" />
        <text x="22" y="40" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="14" fontWeight="800" fill="#ffffff">?</text>
        <text x="48" y="32" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#92400e">Multiple Choice</text>
        <text x="48" y="50" fontFamily="system-ui,sans-serif" fontSize="10" fill="#a16207">Pitanja sa vise odgovora</text>
      </g>
      <g transform="translate(280,110)">
        <rect width="200" height="70" rx="10" fill="#dbeafe" stroke="#3b82f6" strokeWidth="3" />
        <circle cx="22" cy="35" r="14" fill="#3b82f6" />
        <text x="48" y="32" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#1e40af">Drag the Words</text>
        <text x="48" y="50" fontFamily="system-ui,sans-serif" fontSize="10" fill="#1d4ed8">Povuci na pravo mjesto</text>
      </g>
      <g transform="translate(500,110)">
        <rect width="200" height="70" rx="10" fill="#f3e8ff" stroke="#a855f7" strokeWidth="2" />
        <rect x="12" y="22" width="11" height="14" rx="2" fill="#a855f7" />
        <rect x="26" y="22" width="11" height="14" rx="2" fill="#a855f7" />
        <rect x="12" y="38" width="11" height="14" rx="2" fill="#a855f7" />
        <rect x="26" y="38" width="11" height="14" rx="2" fill="#a855f7" />
        <text x="48" y="32" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#6b21a8">Memory Game</text>
        <text x="48" y="50" fontFamily="system-ui,sans-serif" fontSize="10" fill="#7e22ce">Pamti parove kartica</text>
      </g>
      <g transform="translate(60,200)">
        <rect width="200" height="70" rx="10" fill="#fce7f3" stroke="#ec4899" strokeWidth="2" />
        <rect x="12" y="22" width="22" height="22" rx="2" fill="#ec4899" opacity="0.3" />
        <circle cx="20" cy="30" r="3" fill="#ec4899" />
        <circle cx="30" cy="38" r="3" fill="#ec4899" />
        <text x="48" y="32" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#9d174d">Find Hotspot</text>
        <text x="48" y="50" fontFamily="system-ui,sans-serif" fontSize="10" fill="#be185d">Klikni tacku na slici</text>
      </g>
      <g transform="translate(280,200)">
        <rect width="200" height="70" rx="10" fill="#dcfce7" stroke="#22c55e" strokeWidth="2" />
        <text x="22" y="42" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="20" fontWeight="800" fill="#22c55e">v</text>
        <text x="48" y="32" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#14532d">True / False</text>
        <text x="48" y="50" fontFamily="system-ui,sans-serif" fontSize="10" fill="#15803d">Tacno ili netacno</text>
      </g>
      <g transform="translate(500,200)">
        <rect width="200" height="70" rx="10" fill="#fee2e2" stroke="#ef4444" strokeWidth="2" />
        <text x="22" y="42" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="18" fontWeight="800" fill="#ef4444">_</text>
        <text x="48" y="32" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#7f1d1d">Fill in the Blanks</text>
        <text x="48" y="50" fontFamily="system-ui,sans-serif" fontSize="10" fill="#b91c1c">Popuni prazne</text>
      </g>
      <text x="400" y="305" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="11" fontStyle="italic" fill="#64748b">Korak 2: biblioteka H5P tipova (ima ih 30+)</text>
    </Frame>
  );
}

export function Step3Illustration() {
  return (
    <Frame viewBox="0 0 800 340">
      <title>Korak 3: popuni pitanje, ponudjene odgovore i cekiraj tacan</title>
      <defs>
        <linearGradient id="s3bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fefce8" />
          <stop offset="100%" stopColor="#fef3c7" />
        </linearGradient>
      </defs>
      <rect width="800" height="340" fill="url(#s3bg)" />
      <rect x="40" y="30" width="720" height="280" rx="14" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
      <rect x="40" y="30" width="720" height="32" rx="14" fill="#f8fafc" />
      <text x="60" y="52" fontFamily="system-ui,sans-serif" fontSize="13" fontWeight="700" fill="#0f172a">Lumi - Multiple Choice editor</text>
      <text x="60" y="90" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#475569">Question *</text>
      <rect x="60" y="98" width="680" height="36" rx="8" fill="#f8fafc" stroke="#cbd5e1" />
      <text x="74" y="121" fontFamily="system-ui,sans-serif" fontSize="14" fill="#0f172a">Koliko ima sartova islama?</text>
      <text x="60" y="160" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#475569">Available options *</text>

      <g transform="translate(60,170)">
        <rect width="680" height="32" rx="8" fill="#dcfce7" stroke="#22c55e" strokeWidth="2" />
        <rect x="10" y="9" width="14" height="14" rx="3" fill="#22c55e" />
        <text x="17" y="20" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="11" fontWeight="800" fill="#ffffff">v</text>
        <text x="34" y="22" fontFamily="system-ui,sans-serif" fontSize="13" fill="#0f172a">5 sartova</text>
        <text x="640" y="22" fontFamily="system-ui,sans-serif" fontSize="10" fontWeight="700" fill="#15803d">Correct</text>
      </g>
      <g transform="translate(60,210)">
        <rect width="680" height="32" rx="8" fill="#f8fafc" stroke="#cbd5e1" />
        <rect x="10" y="9" width="14" height="14" rx="3" fill="#ffffff" stroke="#cbd5e1" />
        <text x="34" y="22" fontFamily="system-ui,sans-serif" fontSize="13" fill="#0f172a">6 sartova</text>
      </g>
      <g transform="translate(60,250)">
        <rect width="680" height="32" rx="8" fill="#f8fafc" stroke="#cbd5e1" />
        <rect x="10" y="9" width="14" height="14" rx="3" fill="#ffffff" stroke="#cbd5e1" />
        <text x="34" y="22" fontFamily="system-ui,sans-serif" fontSize="13" fill="#0f172a">4 sarta</text>
      </g>
      <g transform="translate(60,290)">
        <rect width="120" height="14" rx="7" fill="#dbeafe" stroke="#3b82f6" strokeDasharray="3,3" />
        <text x="60" y="11" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="9" fontWeight="700" fill="#1d4ed8">+ Add Option</text>
      </g>
      <text x="400" y="328" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="11" fontStyle="italic" fill="#64748b">Korak 3: popuni pitanje, odgovore, cekiraj tacan</text>
    </Frame>
  );
}

export function Step4Illustration() {
  return (
    <Frame viewBox="0 0 800 320">
      <title>Korak 4: sacuvaj h5p u Lumi-ju i uploaduj u Mekteb</title>
      <defs>
        <linearGradient id="s4bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fdf4ff" />
          <stop offset="100%" stopColor="#fae8ff" />
        </linearGradient>
        <linearGradient id="s4save" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
        <linearGradient id="s4upload" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7e22ce" />
        </linearGradient>
      </defs>
      <rect width="800" height="320" fill="url(#s4bg)" />

      <rect x="40" y="40" width="320" height="240" rx="14" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
      <rect x="40" y="40" width="320" height="30" rx="14" fill="#f8fafc" />
      <text x="60" y="60" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#0f172a">Save .h5p file</text>
      <text x="345" y="60" textAnchor="end" fontFamily="system-ui,sans-serif" fontSize="13" fill="#94a3b8">x</text>
      <text x="60" y="100" fontFamily="system-ui,sans-serif" fontSize="11" fill="#475569">File name:</text>
      <rect x="60" y="108" width="280" height="32" rx="6" fill="#f8fafc" stroke="#cbd5e1" />
      <text x="74" y="129" fontFamily="ui-monospace,monospace" fontSize="12" fill="#0f172a">sartovi-imana.h5p</text>
      <text x="60" y="160" fontFamily="system-ui,sans-serif" fontSize="11" fill="#475569">Format:</text>
      <rect x="60" y="168" width="280" height="32" rx="6" fill="#fef3c7" stroke="#f59e0b" />
      <text x="74" y="189" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#92400e">H5P Package (.h5p)</text>
      <g transform="translate(220,222)">
        <rect width="120" height="36" rx="8" fill="url(#s4save)" />
        <text x="60" y="23" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#ffffff">Save</text>
      </g>

      <g transform="translate(370,150)">
        <line x1="0" y1="10" x2="60" y2="10" stroke="#a855f7" strokeWidth="3" />
        <polygon points="60,2 70,10 60,18" fill="#a855f7" />
      </g>

      <rect x="450" y="40" width="320" height="240" rx="14" fill="#ffffff" stroke="#a855f7" strokeWidth="2" />
      <rect x="450" y="40" width="320" height="30" rx="14" fill="#fae8ff" />
      <text x="470" y="60" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#6b21a8">Mekteb - Materijali za nastavu</text>
      <text x="470" y="100" fontFamily="system-ui,sans-serif" fontSize="13" fontWeight="800" fill="#0f172a">Sartovi islama</text>
      <text x="470" y="118" fontFamily="system-ui,sans-serif" fontSize="11" fill="#64748b">Ilmihal - Lekcija 4</text>
      <rect x="470" y="135" width="280" height="80" rx="10" fill="#fdf4ff" stroke="#a855f7" strokeWidth="2" strokeDasharray="6,4" />
      <text x="610" y="180" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="22" fontWeight="800" fill="#a855f7">v</text>
      <text x="610" y="205" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="11" fontWeight="700" fill="#7e22ce">Prevuci .h5p ovdje</text>
      <g transform="translate(540,232)">
        <rect width="140" height="36" rx="8" fill="url(#s4upload)" />
        <text x="70" y="23" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#ffffff">Dodaj H5P vjezbu</text>
      </g>
      <text x="400" y="308" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="11" fontStyle="italic" fill="#64748b">Korak 4: sacuvaj h5p u Lumi-ju, uploaduj u Mekteb</text>
    </Frame>
  );
}

// ── H5P tip primjeri za "Šta je H5P?" sekciju ───────────────────────────
// Tri male inline SVG ilustracije koje pokazuju kako izgledaju različiti
// H5P tipovi (Drag the Words, Multiple Choice, Image Hotspots).

function MiniFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700">
        {label}
      </div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 320 180"
        role="img"
        className="w-full h-auto block"
        preserveAspectRatio="xMidYMid meet"
      >
        {children}
      </svg>
    </div>
  );
}

export function DragWordsExample() {
  return (
    <MiniFrame label="Drag the Words">
      <title>Primjer: Drag the Words — povuci rijec na pravo mjesto</title>
      <rect width="320" height="180" fill="#f8fafc" />
      <text x="16" y="28" fontFamily="system-ui,sans-serif" fontSize="11" fill="#475569">Spoji harf sa imenom:</text>
      <g fontFamily="system-ui,sans-serif" fontSize="13" fontWeight="700">
        <text x="40" y="68" fill="#0f172a">ا</text>
        <rect x="60" y="52" width="70" height="22" rx="6" fill="#dbeafe" stroke="#3b82f6" strokeDasharray="4,3" />
        <text x="95" y="68" textAnchor="middle" fill="#1e3a8a">elif</text>

        <text x="40" y="100" fill="#0f172a">ب</text>
        <rect x="60" y="84" width="70" height="22" rx="6" fill="#f1f5f9" stroke="#cbd5e1" strokeDasharray="4,3" />
        <text x="95" y="100" textAnchor="middle" fill="#94a3b8" fontStyle="italic">...</text>

        <text x="40" y="132" fill="#0f172a">ت</text>
        <rect x="60" y="116" width="70" height="22" rx="6" fill="#f1f5f9" stroke="#cbd5e1" strokeDasharray="4,3" />
        <text x="95" y="132" textAnchor="middle" fill="#94a3b8" fontStyle="italic">...</text>
      </g>
      <g transform="translate(170,55)">
        <rect width="56" height="22" rx="6" fill="#fef3c7" stroke="#f59e0b" />
        <text x="28" y="16" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#92400e">ba</text>
      </g>
      <g transform="translate(240,55)">
        <rect width="56" height="22" rx="6" fill="#fef3c7" stroke="#f59e0b" />
        <text x="28" y="16" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#92400e">ta</text>
      </g>
      <g transform="translate(170,90)">
        <rect width="56" height="22" rx="6" fill="#fef3c7" stroke="#f59e0b" />
        <text x="28" y="16" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#92400e">elif</text>
      </g>
      <g transform="translate(170,126)" opacity="0.6">
        <line x1="0" y1="11" x2="-30" y2="-50" stroke="#10b981" strokeWidth="2" strokeDasharray="3,3" />
        <polygon points="-30,-50 -22,-46 -26,-40" fill="#10b981" />
      </g>
      <text x="160" y="170" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="10" fill="#64748b" fontStyle="italic">Ucenik povlaci ime na ispravan harf</text>
    </MiniFrame>
  );
}

export function MultipleChoiceExample() {
  return (
    <MiniFrame label="Multiple Choice">
      <title>Primjer: Multiple Choice — izaberi tacan odgovor</title>
      <rect width="320" height="180" fill="#f8fafc" />
      <text x="16" y="26" fontFamily="system-ui,sans-serif" fontSize="11" fontWeight="700" fill="#0f172a">Koliko ima sartova imana?</text>
      <g fontFamily="system-ui,sans-serif" fontSize="11">
        <g transform="translate(16,40)">
          <rect width="288" height="26" rx="6" fill="#ffffff" stroke="#cbd5e1" />
          <circle cx="16" cy="13" r="6" fill="#ffffff" stroke="#94a3b8" strokeWidth="2" />
          <text x="32" y="17" fill="#334155">a) 5</text>
        </g>
        <g transform="translate(16,72)">
          <rect width="288" height="26" rx="6" fill="#dcfce7" stroke="#16a34a" strokeWidth="2" />
          <circle cx="16" cy="13" r="6" fill="#16a34a" stroke="#16a34a" strokeWidth="2" />
          <circle cx="16" cy="13" r="2.5" fill="#ffffff" />
          <text x="32" y="17" fontWeight="700" fill="#14532d">b) 6 (tacno)</text>
          <text x="278" y="17" textAnchor="end" fill="#16a34a" fontWeight="700">v</text>
        </g>
        <g transform="translate(16,104)">
          <rect width="288" height="26" rx="6" fill="#ffffff" stroke="#cbd5e1" />
          <circle cx="16" cy="13" r="6" fill="#ffffff" stroke="#94a3b8" strokeWidth="2" />
          <text x="32" y="17" fill="#334155">c) 7</text>
        </g>
        <g transform="translate(16,136)">
          <rect width="120" height="28" rx="8" fill="#3b82f6" />
          <text x="60" y="19" textAnchor="middle" fontWeight="700" fill="#ffffff">Provjeri</text>
        </g>
      </g>
    </MiniFrame>
  );
}

export function ImageHotspotsExample() {
  return (
    <MiniFrame label="Image Hotspots">
      <title>Primjer: Image Hotspots — klikni na dio slike</title>
      <rect width="320" height="180" fill="#fefce8" />
      {/* sky */}
      <rect x="0" y="0" width="320" height="120" fill="#fef9c3" />
      {/* mosque body */}
      <rect x="80" y="80" width="160" height="60" fill="#fde68a" stroke="#a16207" strokeWidth="1.5" />
      {/* dome */}
      <path d="M 90 80 Q 160 30 230 80 Z" fill="#fcd34d" stroke="#a16207" strokeWidth="1.5" />
      {/* minaret left */}
      <rect x="55" y="60" width="14" height="80" fill="#fde68a" stroke="#a16207" strokeWidth="1.5" />
      <polygon points="55,60 62,40 69,60" fill="#a16207" />
      {/* minaret right */}
      <rect x="251" y="60" width="14" height="80" fill="#fde68a" stroke="#a16207" strokeWidth="1.5" />
      <polygon points="251,60 258,40 265,60" fill="#a16207" />
      {/* door (mihrab) */}
      <path d="M 145 140 L 145 110 Q 160 95 175 110 L 175 140 Z" fill="#7c2d12" />
      {/* ground */}
      <rect x="0" y="140" width="320" height="40" fill="#fef3c7" />
      {/* hotspot circles */}
      <g>
        <circle cx="62" cy="50" r="11" fill="#3b82f6" fillOpacity="0.9" stroke="#ffffff" strokeWidth="2.5" />
        <text x="62" y="54" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="11" fontWeight="800" fill="#ffffff">1</text>
      </g>
      <g>
        <circle cx="160" cy="55" r="11" fill="#3b82f6" fillOpacity="0.9" stroke="#ffffff" strokeWidth="2.5" />
        <text x="160" y="59" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="11" fontWeight="800" fill="#ffffff">2</text>
      </g>
      <g>
        <circle cx="160" cy="125" r="11" fill="#16a34a" fillOpacity="0.95" stroke="#ffffff" strokeWidth="2.5" />
        <text x="160" y="129" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="11" fontWeight="800" fill="#ffffff">3</text>
      </g>
      {/* tooltip */}
      <g transform="translate(180,108)">
        <rect width="100" height="22" rx="6" fill="#0f172a" />
        <text x="50" y="15" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="10" fontWeight="700" fill="#ffffff">3 = mihrab</text>
      </g>
      <text x="160" y="172" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="10" fill="#64748b" fontStyle="italic">Klikni na oznacene dijelove dzamije</text>
    </MiniFrame>
  );
}
