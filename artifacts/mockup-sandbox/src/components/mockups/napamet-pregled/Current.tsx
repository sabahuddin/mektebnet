import './_group.css';
import { BookOpen, CheckCircle2, Circle } from 'lucide-react';

const levels = [
  { n: 1, title: 'NAPAMET 1. nivo', items: 32, graded: 9 },
  { n: 2, title: 'NAPAMET 2. nivo', items: 28, graded: 5 },
  { n: 3, title: 'NAPAMET 3. nivo', items: 22, graded: 2 },
  { n: 4, title: 'Dodatak', items: 8, graded: 1 },
];
const names = ['El-Fatiha', 'Ajetul-kursijja', 'Jutarnji zikr', 'Večernji zikr', 'Dova za roditelje'];

export function Current() {
  return <div className="min-h-screen p-5 bg-[#fffdf9]">
    <div className="rounded-2xl border border-emerald-200 overflow-hidden bg-white">
      <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-emerald-700" />
        <h3 className="font-extrabold text-emerald-900">NAPAMET 1. nivo</h3>
      </div>
      <div className="divide-y divide-slate-100">
        <p className="px-4 pt-3 text-[11px] font-black uppercase tracking-wide text-emerald-700">Ocijenjeno</p>
        {names.map((name, i) => <div key={name} className="flex items-center gap-3 px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="min-w-0 flex-1"><p className="font-bold">{name}</p><p className="text-xs text-slate-500 mt-0.5">12.06.2026 · Dobro naučeno</p></div>
          <span className="font-extrabold rounded-full px-2.5 py-1 text-sm bg-emerald-100 text-emerald-700">{6 - (i > 2 ? 1 : 0)}</span>
        </div>)}
        <p className="px-4 pt-3 text-[11px] font-black uppercase tracking-wide text-slate-500">Još nije ocijenjeno</p>
        {Array.from({ length: 7 }, (_, i) => <div key={i} className="flex items-center gap-3 px-4 py-3 bg-slate-50/70 text-slate-400">
          <Circle className="w-5 h-5 text-slate-300 shrink-0" />
          <div className="flex-1"><p className="font-bold">Stavka programa {i + 6}</p><p className="text-xs mt-0.5">Još nije ocijenjeno</p></div>
        </div>)}
        <div className="px-4 py-4 text-center text-sm text-slate-500">... još 76 stavki ispod</div>
      </div>
    </div>
    <div className="mt-4 space-y-4">
      {levels.slice(1).map(level => <div key={level.n} className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
        <div className="px-4 py-3 bg-emerald-50 flex items-center gap-2"><BookOpen className="w-4 h-4 text-emerald-700" /><h3 className="font-extrabold text-emerald-900">{level.title}</h3></div>
        <div className="px-4 py-3 text-sm text-slate-500">{level.items} stavki · {level.graded} ocijenjeno</div>
      </div>)}
    </div>
  </div>;
}