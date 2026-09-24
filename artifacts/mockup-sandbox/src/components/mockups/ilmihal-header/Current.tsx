import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, FilePen, Printer, X } from 'lucide-react';
import './_group.css';

const lessons = Array.from({ length: 66 }, (_, i) => ({ id: i + 1, slug: `lesson-${i + 1}`, naslov: i === 20 ? 'Sura El-Ihlas' : `Lekcija ${i + 1}` }));
const currentId = 21;
const hero = 'https://mekteb.net/uploads/1789928604020-djtbdd-hero.webp';

function LekcijeStrip() {
  const stripRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const currentIdx = lessons.findIndex(l => l.id === currentId);
  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, []);
  return (
    <div className="mb-4">
      <div className="flex items-center justify-center gap-2">
        <button className="h-10 w-10 rounded-lg flex items-center justify-center border border-border/60 bg-white hover:bg-muted disabled:opacity-30 transition-colors text-muted-foreground" aria-label="Nazad"><ChevronLeft className="w-5 h-5 text-muted-foreground" /></button>
        <button className="shrink-0 h-10 w-10 rounded-lg flex items-center justify-center border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors" aria-label="U košnicu"><X className="w-5 h-5" /></button>
        <button className="h-10 w-10 rounded-lg flex items-center justify-center border border-border/60 bg-white hover:bg-muted disabled:opacity-30 transition-colors text-muted-foreground" aria-label="Naprijed"><ChevronRight className="w-5 h-5 text-muted-foreground" /></button>
      </div>
      <div ref={stripRef} className="mt-3 overflow-x-auto flex gap-2 py-1 px-0.5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {lessons.map((l, i) => <button key={l.id} ref={i === currentIdx ? activeRef : undefined}
          className={`relative shrink-0 flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-sm font-bold transition-all min-w-[2.75rem] ${i === currentIdx ? 'bg-teal-500 text-white shadow-md shadow-teal-200 scale-105' : 'bg-white border border-border/50 text-muted-foreground hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50'}`}>
          <span className="text-xs leading-none">{i + 1}</span>
        </button>)}
      </div>
      <div className="text-center mt-1.5"><span className="text-xs text-muted-foreground font-medium">21 / 66 — Sura El-Ihlas</span></div>
    </div>
  );
}

export function Current() {
  return <div className="ilmihal-header-preview min-h-screen py-2 px-4">
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4 justify-end flex-wrap">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"><FilePen className="w-3.5 h-3.5" /> Uredi sadržaj</button>
      </div>
      <div className="mb-5"><h1 className="text-2xl font-extrabold text-foreground leading-tight text-center">Sura El-Ihlas</h1><LekcijeStrip /></div>
      <div className="flex justify-end mb-2">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"><Printer className="w-4 h-4" /> Printaj lekciju</button>
      </div>
      <div className="relative rounded-2xl overflow-hidden mb-5 shadow-sm border-2 border-[rgb(36,143,146)]"><img src={hero} alt="Sura El-Ihlas" className="w-full h-auto aspect-[3/2] object-cover" /></div>
    </div>
  </div>;
}