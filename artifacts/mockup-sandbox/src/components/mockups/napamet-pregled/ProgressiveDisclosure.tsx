import './_group.css';
import { BookOpen, Check, ChevronDown, Search, SlidersHorizontal, Circle } from 'lucide-react';
import { useState } from 'react';

const levels = [
  { n: 1, title: 'NAPAMET 1. nivo', items: 32, graded: 9, color: 'emerald' },
  { n: 2, title: 'NAPAMET 2. nivo', items: 28, graded: 5, color: 'sky' },
  { n: 3, title: 'NAPAMET 3. nivo', items: 22, graded: 2, color: 'amber' },
  { n: 4, title: 'Dodatak', items: 8, graded: 1, color: 'violet' },
];
const items = ['El-Fatiha', 'Ajetul-kursijja', 'Jutarnji zikr', 'Večernji zikr', 'Dova za roditelje', 'Dova pri izlasku iz kuće'];

export function ProgressiveDisclosure() {
  const [open, setOpen] = useState(1);
  const [filter, setFilter] = useState<'all' | 'graded' | 'remaining'>('all');
  return <div className="min-h-screen p-5 bg-[#fffdf9]">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">Napamet</p><h1 className="text-2xl font-black tracking-tight mt-1">Pregled učenja</h1><p className="text-sm text-slate-500 mt-1">Odaberite nivo da vidite stavke i ocjene.</p></div>
      <div className="rounded-2xl bg-emerald-700 text-white px-4 py-3 text-right shadow-sm"><p className="text-[11px] font-bold text-emerald-100">UKUPNO</p><p className="text-2xl font-black leading-none mt-1">17<span className="text-sm font-bold text-emerald-200"> / 90</span></p><p className="text-[11px] text-emerald-100 mt-1">ocijenjeno</p></div>
    </div>
    <div className="grid grid-cols-3 gap-2 mb-4">
      {([['all', 'Sve', '90'], ['graded', 'Ocijenjeno', '17'], ['remaining', 'Preostalo', '73']] as const).map(([value, label, count]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-xl border px-2 py-2 text-left transition ${filter === value ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-500'}`}><p className="text-[11px] font-bold">{label}</p><p className="text-lg font-black leading-none mt-1">{count}</p></button>)}
    </div>
    <div className="flex gap-2 mb-4">
      <div className="relative flex-1"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" /><input className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500" placeholder="Pretraži stavke..." /></div>
      <button className="rounded-xl border border-slate-200 bg-white px-3 text-slate-500"><SlidersHorizontal className="w-4 h-4" /></button>
    </div>
    <div className="space-y-2">
      {levels.map(level => <section key={level.n} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-[0_2px_8px_rgba(15,70,50,.04)]">
        <button onClick={() => setOpen(open === level.n ? 0 : level.n)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50">
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${level.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' : level.color === 'sky' ? 'bg-sky-100 text-sky-700' : level.color === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}><BookOpen className="w-4 h-4" /></span>
          <span className="flex-1"><span className="block font-extrabold text-slate-800">{level.title}</span><span className="block text-xs text-slate-500 mt-0.5">{level.graded} ocijenjeno <span className="text-slate-300">·</span> {level.items - level.graded} čeka pregled</span></span>
          <span className="text-xs font-black text-slate-400 mr-1">{Math.round(level.graded / level.items * 100)}%</span><ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open === level.n ? 'rotate-180' : ''}`} />
        </button>
        {open === level.n && <div className="border-t border-slate-100 divide-y divide-slate-100">
          <div className="px-4 py-2.5 bg-slate-50/70 flex items-center justify-between"><span className="text-[11px] font-black uppercase tracking-wide text-slate-500">{filter === 'graded' ? 'Ocijenjeno' : filter === 'remaining' ? 'Čeka pregled' : 'Sve stavke'}</span><span className="text-xs text-slate-400">Nivo {level.n}</span></div>
          {items.slice(0, filter === 'all' ? 5 : filter === 'graded' ? 2 : 3).map((item, i) => <div key={item} className="flex items-center gap-3 px-4 py-3"><span className={`grid h-7 w-7 place-items-center rounded-full ${i < 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{i < 2 ? <Check className="w-4 h-4" /> : <Circle className="w-3 h-3" />}</span><span className={`flex-1 text-sm font-bold ${i < 2 ? 'text-slate-800' : 'text-slate-400'}`}>{item}</span>{i < 2 && <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-700">6</span>}</div>)}
          <button className="w-full py-3 text-sm font-extrabold text-emerald-700 hover:bg-emerald-50">Prikaži svih {level.items} stavki</button>
        </div>}
      </section>)}
    </div>
  </div>;
}