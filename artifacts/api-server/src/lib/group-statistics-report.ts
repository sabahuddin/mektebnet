import type { GroupStatisticsDetails } from "./group-statistics-details.js";

type Cell = string | number | null;
export interface ReportTable {
  title: string;
  headers: string[];
  rows: Cell[][];
}
export interface ReportSection {
  id: string;
  title: string;
  summary: Array<{ label: string; value: Cell }>;
  tables: ReportTable[];
}

interface Student {
  id: number; ime: string; prisustvoPct: number | null;
  prisutanCount: number; odsutanCount: number; zakasnioCount: number;
  opravdanCount: number; ukupnoPrisustvo: number;
  prisustvoPoDatumu: Record<string, string>;
  mjesecnoStats: Array<{ mjesec: string; prisutan: number; ukupno: number; pct: number | null }>;
  ukupnaProsjecna: number | null;
  prosjecneOcjene: Record<string, { prosjek: number; broj: number }>;
}
interface Stats {
  ucenici: Student[]; detaljiUcenika: GroupStatisticsDetails[];
  ukupnoCasova: number; grupaPrisustvoPct: number | null; grupaProsjekOcjena: number | null;
  mjesecniPregled: Array<{ mjesec: string; prisutan: number; odsutan: number; zakasnio: number; opravdan: number; ukupno: number; pct: number | null }>;
}
interface Exercises {
  ucenici: Array<{ id: number; naseVjezbe: number; h5pVjezbe: number; h5pPokusaji: number; h5pProsjek: number | null; etapneVjezbe: number; etapnePokusaji: number; etapneProsjek: number | null }>;
  ukupno: { naseVjezbe: number; h5pPokusaji: number; h5pProsjek: number | null; etapnePokusaji: number; etapneProsjek: number | null };
}
interface Interactive {
  ukupnoPokusaja: number; prosjekTacnosti: number | null;
  ucenici: Array<{ id: number; brojPokusaja: number; procenatTacnih: number | null; pomocBroj: number; tacnoNakonPonovnogCitanja: number }>;
  pitanja: Array<{ lekcijaNaslov: string; pitanjeTekst: string; brojPokusaja: number; netacniPokusaji: number; procenatTacnih: number }>;
}

const pct = (n: number | null) => n === null ? null : `${Math.round(n * 10) / 10}%`;
const average = (values: number[]) => values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null;
const number = (n: number | null) => n === null ? null : Math.round(n * 100) / 100;
const descriptive = (s: string | null) => s === "uradjeno" ? "Urađeno" : s === "neuradjeno" ? "Neurađeno" : s;
const statuses: Record<string, string> = { prisutan: "Prisutan", odsutan: "Odsutan", zakasnio: "Zakasnio", opravdan: "Opravdan" };
const metric = (label: string, value: Cell) => ({ label, value });
const table = (title: string, headers: string[], rows: Cell[][]): ReportTable => ({ title, headers, rows });

/** Presentation only: all source records and school-year filtering come from
 * the same authorized statistics loaders as the group panel. */
export function buildGroupStatisticsReport(stats: Stats, exercises: Exercises, interactive: Interactive): ReportSection[] {
  const students = [...stats.ucenici].sort((a, b) => a.ime.localeCompare(b.ime, "bs"));
  const details = new Map(stats.detaljiUcenika.map(d => [d.id, d]));
  const ex = new Map(exercises.ucenici.map(d => [d.id, d]));
  const iv = new Map(interactive.ucenici.map(d => [d.id, d]));
  // Missing data is an error, not a misleading zero in an official report.
  for (const u of students) {
    if (!details.has(u.id) || !ex.has(u.id) || !iv.has(u.id)) throw new Error("Nepotpuna statistika grupe");
  }
  const all = students.map(u => details.get(u.id)!);
  const quizzes = all.flatMap(d => d.kvizovi);
  const grades = all.flatMap(d => d.ocjene);
  const lessons = all.reduce((sum, d) => sum + d.lekcije.length, 0);
  const stages = all.flatMap(d => d.etape);
  const medals = all.flatMap(d => d.medaljoni);
  const numeric = grades.filter(o => o.ocjena !== null);
  const described = grades.filter(o => o.ocjena === null && !!o.ocjenaOpisna);
  const byDetail = (rows: (d: GroupStatisticsDetails) => Cell[][]) =>
    students.flatMap(u => rows(details.get(u.id)!).map(row => [u.ime, ...row]));

  return [
    {
      id: "prisustvo", title: "Prisustvo",
      summary: [metric("Učenika", students.length), metric("Časova", stats.ukupnoCasova), metric("Prisustvo grupe", pct(stats.grupaPrisustvoPct))],
      tables: [
        table("Prisustvo po učeniku", ["Učenik", "Prisustvo (%)", "Prisutan", "Odsutan", "Zakasnio", "Opravdan", "Ukupno"],
          students.map(u => [u.ime, pct(u.prisustvoPct), u.prisutanCount, u.odsutanCount, u.zakasnioCount, u.opravdanCount, u.ukupnoPrisustvo])),
        table("Evidencija prisustva", ["Učenik", "Datum", "Čas", "Status"], students.flatMap(u =>
          Object.entries(u.prisustvoPoDatumu).sort(([a], [b]) => a.localeCompare(b)).map(([key, status]) => {
            const [date, lesson] = key.split("#");
            return [u.ime, date, Number(lesson), statuses[status] ?? status];
          }))),
        table("Prisustvo po mjesecu – grupa", ["Mjesec", "Prisutan", "Odsutan", "Zakasnio", "Opravdan", "Ukupno", "Prisustvo (%)"],
          stats.mjesecniPregled.map(m => [m.mjesec, m.prisutan, m.odsutan, m.zakasnio, m.opravdan, m.ukupno, pct(m.pct)])),
        table("Prisustvo po mjesecu – učenici", ["Učenik", "Mjesec", "Prisutan", "Ukupno", "Prisustvo (%)"],
          students.flatMap(u => u.mjesecnoStats.map(m => [u.ime, m.mjesec, m.prisutan, m.ukupno, pct(m.pct)]))),
      ],
    },
    {
      id: "lekcije", title: "Lekcije",
      summary: [metric("Završenih lekcija", lessons), metric("Prosjek po učeniku", students.length ? number(lessons / students.length) : null)],
      tables: [
        table("Lekcije po učeniku", ["Učenik", "Završeno"], students.map(u => [u.ime, details.get(u.id)!.lekcije.length])),
        table("Završene lekcije", ["Učenik", "Lekcija", "Nivo"], byDetail(d => d.lekcije.map(l => [l.naslov, l.nivo]))),
      ],
    },
    {
      id: "vjezbe", title: "Vježbe",
      summary: [metric("Naše vježbe", exercises.ukupno.naseVjezbe), metric("H5P pokušaji", exercises.ukupno.h5pPokusaji),
        metric("H5P prosjek", pct(exercises.ukupno.h5pProsjek)), metric("Etapne vježbe – pokušaji vježbi", exercises.ukupno.etapnePokusaji),
        metric("Etapne vježbe – prosjek", pct(exercises.ukupno.etapneProsjek)),
        metric("Odgovori na pitanja u lekcijama", interactive.ukupnoPokusaja), metric("Tačnost odgovora", pct(interactive.prosjekTacnosti))],
      tables: [
        table("Vježbe po učeniku", ["Učenik", "Naše vježbe", "H5P vježbe", "H5P pokušaji", "H5P prosjek", "Etapne vježbe", "Pokušaji vježbi", "Prosjek vježbi"], students.map(u => {
          const v = ex.get(u.id)!;
          return [u.ime, v.naseVjezbe, v.h5pVjezbe, v.h5pPokusaji, pct(v.h5pProsjek), v.etapneVjezbe, v.etapnePokusaji, pct(v.etapneProsjek)];
        })),
        table("Odgovori na pitanja u lekcijama – nisu završene vježbe", ["Učenik", "Odgovori", "Tačnost", "Korištena pomoć", "Tačno nakon ponovnog čitanja"], students.map(u => {
          const v = iv.get(u.id)!;
          return [u.ime, v.brojPokusaja, pct(v.procenatTacnih), v.pomocBroj, v.tacnoNakonPonovnogCitanja];
        })),
        table("Gdje učenici griješe", ["Lekcija", "Pitanje", "Pokušaji", "Pogrešni", "Tačnost"], interactive.pitanja.map(p =>
          [p.lekcijaNaslov, p.pitanjeTekst, p.brojPokusaja, p.netacniPokusaji, pct(p.procenatTacnih)])),
      ],
    },
    {
      id: "kvizovi", title: "Kvizovi",
      summary: [metric("Pokušaja kvizova", quizzes.length), metric("Različitih kvizova", new Set(quizzes.map(k => k.kvizId)).size),
        metric("Prosječan rezultat", pct(average(quizzes.map(k => k.procenat)))), metric("Bodova", quizzes.reduce((sum, k) => sum + k.bodovi, 0))],
      tables: [
        table("Kvizovi po učeniku", ["Učenik", "Pokušaji", "Različiti kvizovi", "Prosjek", "Bodovi"], students.map(u => {
          const k = details.get(u.id)!.kvizovi;
          return [u.ime, k.length, new Set(k.map(q => q.kvizId)).size, pct(average(k.map(q => q.procenat))), k.reduce((sum, q) => sum + q.bodovi, 0)];
        })),
        table("Pokušaji kvizova", ["Učenik", "Datum", "Kviz", "Nivo", "Tačno", "Ukupno pitanja", "Rezultat (%)", "Bodovi"],
          byDetail(d => d.kvizovi.map(k => [k.datum, k.naslov, k.nivo, k.tacniOdgovori, k.ukupnoPitanja, pct(k.procenat), k.bodovi]))),
      ],
    },
    {
      id: "ocjene", title: "Ocjene",
      summary: [metric("Prosjek grupe – samo numeričke ocjene", stats.grupaProsjekOcjena), metric("Numeričkih ocjena", numeric.length), metric("Opisnih ocjena", described.length)],
      tables: [
        table("Ocjene po učeniku", ["Učenik", "Prosjek", "Numeričkih", "Opisnih"], students.map(u => {
          const o = details.get(u.id)!.ocjene;
          return [u.ime, u.ukupnaProsjecna, o.filter(g => g.ocjena !== null).length, o.filter(g => g.ocjena === null && !!g.ocjenaOpisna).length];
        })),
        table("Ocjene po predmetima", ["Učenik", "Predmet", "Prosjek", "Numeričkih ocjena"], students.flatMap(u =>
          Object.entries(u.prosjecneOcjene).map(([subject, g]) => [u.ime, subject, g.prosjek, g.broj]))),
        table("Numeričke ocjene", ["Učenik", "Datum", "Predmet", "Ocjena", "Lekcija", "Napomena"],
          byDetail(d => d.ocjene.filter(o => o.ocjena !== null).map(o => [o.datum, o.predmet, o.ocjena, o.lekcijaNaslov, o.napomena]))),
        table("Opisne ocjene – ne ulaze u prosjek", ["Učenik", "Datum", "Predmet", "Opisna ocjena", "Lekcija", "Napomena"],
          byDetail(d => d.ocjene.filter(o => o.ocjena === null && !!o.ocjenaOpisna).map(o => [o.datum, o.predmet, descriptive(o.ocjenaOpisna), o.lekcijaNaslov, o.napomena]))),
      ],
    },
    {
      id: "etape", title: "Etape i medaljoni",
      summary: [metric("Pokušanih etapa", stages.length), metric("Položenih etapa", stages.filter(s => s.polozeno).length), metric("Osvojenih medaljona", medals.length)],
      tables: [
        table("Etape i medaljoni po učeniku – zvjezdice muallima nisu medaljoni", ["Učenik", "Pokušano etapa", "Položeno etapa", "Osvojeni medaljoni"], students.map(u => {
          const d = details.get(u.id)!;
          return [u.ime, d.etape.length, d.etape.filter(s => s.polozeno).length, d.medaljoni.length];
        })),
        table("Etape – ponovni pokušaji ne dupliraju etapu", ["Učenik", "Etapa", "Nivo", "Status", "Pokušaji", "Najbolji rezultat (%)"],
          byDetail(d => d.etape.map(e => [e.naziv, e.nivo, e.polozeno ? "Položeno" : "Nije položeno", e.brojPokusaja, pct(e.najboljiProcenat)]))),
        table("Osvojeni medaljoni", ["Učenik", "Medaljon", "Nivo", "Datum"], byDetail(d => d.medaljoni.map(m => [m.naziv, m.nivo, m.datum]))),
      ],
    },
  ];
}

export function sanitizeExcelCell(value: Cell): Cell {
  return typeof value === "string" && /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
}

export async function groupReportWorkbook(report: { naslov: string; period: string; sections: ReportSection[] }) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const append = (title: string, rows: Cell[][]) => {
    const sheet = XLSX.utils.aoa_to_sheet(rows.map(row => row.map(sanitizeExcelCell)));
    const columns = Math.max(2, ...rows.map(row => row.length));
    sheet["!cols"] = Array.from({ length: columns }, (_, col) => ({ wch: col === 0 ? 30 : 22 }));
    XLSX.utils.book_append_sheet(workbook, sheet, title);
  };
  append("Zbirni izvještaj", [
    [report.naslov], [report.period], [],
    ...report.sections.flatMap(s => [[s.title], ...s.summary.map(m => [m.label, m.value]), []]),
  ]);
  for (const section of report.sections) {
    append(section.title, [
      [report.period], [section.title], ...section.summary.map(m => [m.label, m.value]), [],
      ...section.tables.flatMap(t => [[t.title], t.headers, ...t.rows, []]),
    ]);
  }
  return workbook;
}
