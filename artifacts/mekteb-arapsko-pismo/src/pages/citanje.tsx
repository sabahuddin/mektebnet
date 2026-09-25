// Učim čitati — pregled lekcija.
//
// Zaseban dio platforme. Ne traži ništa iz Sufare ni iz lekcija mekteba;
// kreće od nule.
import { Link } from "wouter";
import { BookOpenCheck, Lock } from "lucide-react";
import { PROGRAM_CITANJA } from "@/data/citanje-program";
import { LEKCIJE_CITANJA } from "@/data/citanje-lekcije";
import { RIJECI_CITANJA } from "@/data/citanje-rijeci";
import { noviSlogovi } from "@/data/citanje-slogovi";

export default function CitanjePage() {
  const napisane = new Set(LEKCIJE_CITANJA.map((l) => l.broj));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center shrink-0">
            <BookOpenCheck className="w-6 h-6 text-teal-700" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Učim čitati</h1>
            <p className="text-sm text-muted-foreground">Arapsko pismo od prve lekcije, bez predznanja.</p>
          </div>
        </div>
        <p className="text-muted-foreground max-w-prose">
          Slova se ne uče abecednim redom nego po tome koliko se često javljaju, a slična
          slova se razdvajaju da se ne miješaju. Zato dijete čita prvu riječ već u prvoj
          lekciji, a ne u sedmoj.
        </p>
      </header>

      <ol className="flex flex-col gap-2">
        {PROGRAM_CITANJA.map((l) => {
          const spremna = napisane.has(l.broj);
          const rijeci = RIJECI_CITANJA.filter((r) => r.lekcija === l.broj).length;
          const slogovi = noviSlogovi(l.broj).length;
          const sadrzaj = [
            slogovi ? `${slogovi} slogova` : null,
            rijeci ? `${rijeci} riječi` : null,
          ].filter(Boolean).join(" · ");

          const tijelo = (
            <div className={`flex items-center gap-4 rounded-2xl border p-4 transition-colors ${
              spremna ? "border-border/60 bg-white hover:border-teal-400" : "border-dashed border-border/50 bg-muted/30"
            }`}>
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                spremna ? "bg-teal-600 text-white" : "bg-muted text-muted-foreground"
              }`}>{l.broj}</span>
              <div className="min-w-0 flex-1">
                <div className="font-bold leading-tight">{l.naziv}</div>
                <div className="text-sm text-muted-foreground truncate">
                  <span dir="rtl" lang="ar" className="text-lg align-middle">{l.harfovi.join(" ")}</span>
                  {l.znakovi.length > 0 && <span className="ml-2">+ {l.znakovi.join(", ")}</span>}
                </div>
              </div>
              {spremna
                ? <span className="text-sm text-muted-foreground whitespace-nowrap">{sadrzaj}</span>
                : <span className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap"><Lock className="w-3.5 h-3.5" /> u pripremi</span>}
            </div>
          );

          return (
            <li key={l.broj}>
              {spremna ? <Link href={`/citanje/${l.broj}`}>{tijelo}</Link> : tijelo}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
