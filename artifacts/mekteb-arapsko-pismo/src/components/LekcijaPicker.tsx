import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useLanguage } from "@/context/language";

export interface LekcijaOption {
  id: number;
  naslov: string;
  nivo: number;
  slug?: string;
}

interface Props {
  lekcije: LekcijaOption[];
  value: string;
  onChange: (naslov: string) => void;
  placeholder?: string;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .replace(/č/g, "c")
    .replace(/ć/g, "c");
}

export function LekcijaPicker({ lekcije, value, onChange, placeholder }: Props) {
  const { t } = useLanguage();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const numbered = useMemo(
    () => lekcije.map((l, i) => ({ ...l, broj: i + 1 })),
    [lekcije]
  );

  const matches = useMemo(() => {
    const q = normalize(query.trim());
    if (q.length < 2) return numbered.slice(0, 50);
    return numbered.filter(l => normalize(l.naslov).includes(q) || String(l.broj) === q).slice(0, 50);
  }, [numbered, query]);

  const selected = numbered.find(l => l.naslov === value);

  const pick = (l: typeof numbered[number]) => {
    onChange(l.naslov);
    setQuery(l.naslov);
    setOpen(false);
  };

  const clear = () => {
    onChange("");
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); onChange(e.target.value); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? t("Pretraži lekciju…")}
          className="w-full border border-border rounded-xl pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
        />
        {(query || value) && (
          <button type="button" onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted text-muted-foreground"
            aria-label={t("Obriši")}>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {selected && !open && (
        <div className="text-[11px] text-muted-foreground mt-1 px-1">
          #{selected.broj} • {t("Nivo {nivo}", { nivo: String(selected.nivo) })}
        </div>
      )}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto bg-white border border-border rounded-xl shadow-lg">
          {matches.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">{t("Nema rezultata")}</div>
          ) : matches.map(l => (
            <button
              key={l.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); pick(l); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 ${l.naslov === value ? "bg-primary/10 font-semibold" : ""}`}
            >
              <span className="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-full bg-primary/10 text-primary text-xs font-bold">
                {l.broj}
              </span>
              <span className="flex-1 truncate">{l.naslov}</span>
              <span className="text-[10px] text-muted-foreground">{t("Nivo {nivo}", { nivo: String(l.nivo) })}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
