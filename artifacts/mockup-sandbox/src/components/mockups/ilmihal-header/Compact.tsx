import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, FilePen, Printer, X } from 'lucide-react';
import './_group.css';

const lessons = Array.from({ length: 66 }, (_, i) => i + 1);
const hero = 'https://mekteb.net/uploads/1789928604020-djtbdd-hero.webp';

export function Compact() {
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, []);
  return <div className="ilmihal-header-preview min-h-screen py-2 px-4">
    <div className="max-w-3xl mx-auto">
      <div className="mb-2">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[1fr_minmax(0,2fr)_1fr] items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5">
            <button aria-label="Nazad" title="Nazad" className="h-9 w-9 rounded-lg flex items-center justify-center border border-border/60 bg-white hover:bg-muted text-muted-foreground"><ChevronLeft className="w-5 h-5" /></button>
            <button aria-label="U košnicu" title="Vrati se u košnicu" className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100"><X className="w-5 h-5" /></button>
          </div>
          <div className="min-w-0 text-center">
            <h1 className="text-lg sm:text-xl font-extrabold text-foreground leading-tight line-clamp-2">Sura El-Ihlas</h1>
            <span className="text-[11px] text-muted-foreground font-semibold">21 / 66</span>
          </div>
          <div className="flex items-center justify-end gap-1.5">
            <button aria-label="Naprijed" title="Naprijed" className="h-9 w-9 rounded-lg flex items-center justify-center border border-border/60 bg-white hover:bg-muted text-muted-foreground"><ChevronRight className="w-5 h-5" /></button>
            <button aria-label="Printaj lekciju" title="Printaj lekciju" className="h-9 w-9 rounded-lg flex items-center justify-center bg-slate-100 text-slate-600 hover:bg-slate-200"><Printer className="w-4 h-4" /></button>
            <button aria-label="Uredi sadržaj" title="Uredi sadržaj" className="h-9 w-9 rounded-lg flex items-center justify-center bg-amber-100 text-amber-700 hover:bg-amber-200"><FilePen className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="mt-1.5 overflow-x-auto flex gap-1.5 py-1 px-0.5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {lessons.map(i => <button key={i} ref={i === 21 ? activeRef : undefined} title={`Lekcija ${i}`}
            className={`relative shrink-0 flex flex-col items-center rounded-lg px-2.5 py-1.5 text-sm font-bold transition-all min-w-[2.5rem] ${i === 21 ? 'bg-teal-500 text-white shadow-md shadow-teal-200 scale-105' : 'bg-white border border-border/50 text-muted-foreground hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50'}`}>
            <span className="text-xs leading-none">{i}</span>
          </button>)}
        </div>
      </div>
      <div className="relative rounded-2xl overflow-hidden mb-5 shadow-sm border-2 border-[rgb(36,143,146)]"><img src={hero} alt="Sura El-Ihlas" className="w-full h-auto aspect-[3/2] object-cover" /></div>
    </div>
  </div>;
}