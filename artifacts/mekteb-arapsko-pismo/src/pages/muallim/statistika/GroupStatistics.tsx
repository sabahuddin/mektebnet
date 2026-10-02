import { Fragment, useState } from "react";
import type { ReactNode } from "react";
import { CalendarCheck, BookOpen, Sparkles, ClipboardList, Star, Award, ChevronDown, Eye } from "lucide-react";
import { useLanguage } from "@/context/language";
import type { GStat, GVjezbe, GInteraktivni, GroupStatisticsDetails } from "./types";

type SectionId = "prisustvo" | "lekcije" | "vjezbe" | "kvizovi" | "ocjene" | "etape";

const MJESECI: Record<string, string> = {
  "01": "Januar", "02": "Februar", "03": "Mart", "04": "April", "05": "Maj", "06": "Juni",
  "07": "Juli", "08": "August", "09": "Septembar", "10": "Oktobar", "11": "Novembar", "12": "Decembar",
};

const dash = "–";
const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? String(Math.round(v * 100) / 100) : dash);
const pct = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? `${Math.round(v * 10) / 10}%` : dash);
const fmtDate = (s: string | null | undefined) => {
  if (!s) return dash;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return dash;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}.`;
};
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

interface Row { id: number; ime: string; cells: ReactNode[]; detail: ReactNode }

function Empty({ text }: { text: string }) {
  return <p className="py-3 text-center text-sm text-muted-foreground">{text}</p>;
}

function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border/50 bg-white p-4 text-center">
      <div className="text-2xl font-extrabold text-primary">{value}</div>
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground/80">{hint}</div>}
    </div>
  );
}

function StudentTable({ title, heads, rows, onOpen, emptyText }: { title: string; heads: string[]; rows: Row[]; onOpen: (id: number) => void; emptyText: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-white">
      <div className="flex items-center justify-between border-b border-border/30 bg-muted/30 px-4 py-3">
        <h4 className="font-extrabold text-foreground">{title}</h4>
        <span className="text-xs text-muted-foreground">{rows.length} {t("učenika")}</span>
      </div>
      {rows.length === 0 ? <Empty text={emptyText} /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead className="border-b border-border/50 bg-muted/20">
              <tr>
                <th className="w-10" />
                <th className="px-3 py-2.5 text-left text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{t("Učenik")}</th>
                {heads.map(h => <th key={h} className="px-3 py-2.5 text-center text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{h}</th>)}
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const isOpen = open === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr className="cursor-pointer border-b border-border/30 transition-colors hover:bg-muted/20" onClick={() => setOpen(isOpen ? null : r.id)} data-testid={`row-stat-ucenik-${r.id}`}>
                      <td className="pl-3"><ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} /></td>
                      <td className="whitespace-nowrap px-3 py-3 font-bold text-foreground">{r.ime}</td>
                      {r.cells.map((c, i) => <td key={i} className="px-3 py-3 text-center text-sm font-bold text-foreground">{c}</td>)}
                      <td className="pr-3">
                        <button type="button" title={t("Puni profil")} onClick={e => { e.stopPropagation(); onOpen(r.id); }} className="rounded-lg p-1.5 text-primary hover:bg-primary/10" data-testid={`btn-stat-profil-${r.id}`}>
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-border/30 bg-muted/10">
                        <td colSpan={heads.length + 3} className="px-4 py-4"><div className="mx-auto max-w-3xl">{r.detail}</div></td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{children}</span>;
}

function ListItem({ children }: { children: ReactNode }) {
  return <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-white px-3 py-2 text-sm">{children}</li>;
}

export function GroupStatistics({ stat, vjezbe, interaktivni, onOpenStudent }: { stat: GStat; vjezbe: GVjezbe | null; interaktivni: GInteraktivni | null; onOpenStudent: (id: number) => void }) {
  const { t } = useLanguage();
  const [section, setSection] = useState<SectionId>("prisustvo");
  const det = new Map<number, GroupStatisticsDetails>((stat.detaljiUcenika ?? []).map(d => [d.id, d]));
  const hasDet = stat.detaljiUcenika !== undefined;
  const noDet = <Empty text={t("Detalji nisu dostupni")} />;
  const ucenici = stat.ucenici;
  const nUc = ucenici.length;

  const tabs: { id: SectionId; label: string; icon: typeof Star }[] = [
    { id: "prisustvo", label: t("Prisustvo"), icon: CalendarCheck },
    { id: "lekcije", label: t("Lekcije"), icon: BookOpen },
    { id: "vjezbe", label: t("Vježbe"), icon: Sparkles },
    { id: "kvizovi", label: t("Kvizovi"), icon: ClipboardList },
    { id: "ocjene", label: t("Ocjene"), icon: Star },
    { id: "etape", label: t("Etape i medaljoni"), icon: Award },
  ];

  let body: ReactNode = null;

  if (section === "prisustvo") {
    const rows: Row[] = ucenici.map(u => ({
      id: u.id, ime: u.ime,
      cells: [pct(u.prisustvoPct), u.prisutanCount, u.odsutanCount, u.zakasnioCount, u.opravdanCount],
      detail: (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">{t("Prisustvo po datumima")}</p>
            {stat.svaDatumi.filter(d => u.prisustvoPoDatumu[d]).length === 0 ? <Empty text={t("Nema zabilježenih časova")} /> : (
              <div className="flex flex-wrap justify-center gap-2">
                {stat.svaDatumi.map(d => {
                  const st = u.prisustvoPoDatumu[d];
                  if (!st) return null;
                  const cls = st === "prisutan" ? "bg-emerald-500" : st === "odsutan" ? "bg-red-500" : st === "zakasnio" ? "bg-amber-400" : "bg-blue-400";
                  const label = st === "prisutan" ? "P" : st === "odsutan" ? "O" : st === "zakasnio" ? "Z" : "OP";
                  const [datum, cas] = d.split("#");
                  const p = (datum || "").split("-");
                  return (
                    <div key={d} className="flex flex-col items-center gap-0.5">
                      <span className={`inline-block h-8 w-8 rounded-md text-center text-xs font-bold leading-8 text-white ${cls}`}>{label}</span>
                      <span className="text-[10px] font-medium text-muted-foreground">{p[2] ?? dash}.{p[1] ?? dash} · {cas ?? dash}. {t("čas")}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-center text-xs text-muted-foreground">{t("P = Prisutan, O = Odsutan, Z = Zakasnio, OP = Opravdan")}</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">{t("Prisustvo po mjesecima")}</p>
            {u.mjesecnoStats.length === 0 ? <Empty text={t("Nema podataka po mjesecima")} /> : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {u.mjesecnoStats.map(m => {
                  const p = m.mjesec.split("-");
                  return <ListItem key={m.mjesec}><span className="font-bold">{MJESECI[p[1]] ? t(MJESECI[p[1]]) : p[1]} {p[0]}</span><span>{pct(m.pct)} <span className="text-xs text-muted-foreground">({m.prisutan}/{m.ukupno})</span></span></ListItem>;
                })}
              </ul>
            )}
          </div>
        </div>
      ),
    }));
    body = (
      <>
        <div className="grid grid-cols-2 gap-3"><Kpi label={t("Prisustvo grupe")} value={pct(stat.grupaPrisustvoPct)} /><Kpi label={t("Održanih časova")} value={stat.ukupnoCasova} /></div>
        <StudentTable title={t("Prisustvo po učeniku")} heads={[t("Prisustvo"), "P", "O", "Z", "OP"]} rows={rows} onOpen={onOpenStudent} emptyText={t("Nema učenika u grupi")} />
      </>
    );
  } else if (section === "lekcije") {
    const total = ucenici.reduce((s, u) => s + (det.get(u.id)?.lekcije.length ?? 0), 0);
    const rows: Row[] = ucenici.map(u => {
      const d = det.get(u.id);
      return {
        id: u.id, ime: u.ime, cells: [d ? d.lekcije.length : dash],
        detail: !d ? noDet : d.lekcije.length === 0 ? <Empty text={t("Još nema završenih lekcija")} /> : (
          <ul className="space-y-2">{d.lekcije.map(l => <ListItem key={l.id}><span className="font-bold">{l.naslov}</span><Chip>{t("Nivo")} {l.nivo}</Chip></ListItem>)}</ul>
        ),
      };
    });
    body = (
      <>
        <div className="grid grid-cols-2 gap-3"><Kpi label={t("Završenih lekcija")} value={hasDet ? total : dash} /><Kpi label={t("Prosjek po učeniku")} value={hasDet && nUc ? num(total / nUc) : dash} /></div>
        <StudentTable title={t("Lekcije po učeniku")} heads={[t("Završeno")]} rows={rows} onOpen={onOpenStudent} emptyText={t("Nema učenika u grupi")} />
      </>
    );
  } else if (section === "vjezbe") {
    const vm = new Map((vjezbe?.ucenici ?? []).map(v => [v.id, v]));
    const im = new Map((interaktivni?.ucenici ?? []).map(v => [v.id, v]));
    const rows: Row[] = ucenici.map(u => {
      const v = vm.get(u.id);
      const iv = im.get(u.id);
      return {
        id: u.id, ime: u.ime,
        cells: v ? [v.naseVjezbe, v.h5pVjezbe, v.h5pPokusaji, pct(v.h5pProsjek), v.etapneVjezbe, v.etapnePokusaji, pct(v.etapneProsjek)] : [dash, dash, dash, dash, dash, dash, dash],
        detail: !v ? <Empty text={t("Statistiku vježbi nije moguće učitati")} /> : (
          <ul className="grid gap-2 sm:grid-cols-2">
            <ListItem><span>{t("Naše vježbe")}</span><b>{v.naseVjezbe}</b></ListItem>
            <ListItem><span>{t("H5P vježbe")}</span><b>{v.h5pVjezbe}</b></ListItem>
            <ListItem><span>{t("H5P pokušaji")}</span><b>{v.h5pPokusaji}</b></ListItem>
            <ListItem><span>{t("H5P prosjek")}</span><b>{pct(v.h5pProsjek)}</b></ListItem>
            <ListItem><span>{t("Etapne vježbe")}</span><b>{v.etapneVjezbe}</b></ListItem>
            <ListItem><span>{t("Etapne vježbe – pokušaji vježbi")}</span><b>{v.etapnePokusaji}</b></ListItem>
            <ListItem><span>{t("Etapne vježbe – prosjek")}</span><b>{pct(v.etapneProsjek)}</b></ListItem>
            {interaktivni ? (<>
              <ListItem><span>{t("Odgovori na pitanja u lekcijama")}</span><b>{iv ? iv.brojPokusaja : 0}</b></ListItem>
              <ListItem><span>{t("Tačnost odgovora")}</span><b>{pct(iv?.procenatTacnih)}</b></ListItem>
              <ListItem><span>{t("Korištena pomoć")}</span><b>{iv ? iv.pomocBroj : 0}</b></ListItem>
              <ListItem><span>{t("Tačno nakon ponovnog čitanja")}</span><b>{iv ? iv.tacnoNakonPonovnogCitanja : 0}</b></ListItem>
            </>) : <ListItem><span>{t("Odgovori na pitanja u lekcijama")}</span><b>{t("Nije moguće učitati")}</b></ListItem>}
          </ul>
        ),
      };
    });
    body = (
      <>
        {vjezbe ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={t("Naše vježbe")} value={vjezbe.ukupno.naseVjezbe} />
            <Kpi label={t("H5P pokušaji")} value={vjezbe.ukupno.h5pPokusaji} hint={pct(vjezbe.ukupno.h5pProsjek)} />
            <Kpi label={t("Etapne vježbe – pokušaji vježbi")} value={vjezbe.ukupno.etapnePokusaji} hint={pct(vjezbe.ukupno.etapneProsjek)} />
            <Kpi label={t("Odgovori na pitanja u lekcijama")} value={interaktivni ? interaktivni.ukupnoPokusaja : dash} hint={interaktivni ? pct(interaktivni.prosjekTacnosti) : t("Nije moguće učitati")} />
          </div>
        ) : <div className="rounded-2xl border border-border/50 bg-white p-6 text-center text-sm text-muted-foreground">{t("Statistiku vježbi nije moguće učitati")}</div>}
        <StudentTable title={t("Vježbe po učeniku")} heads={[t("Naše"), "H5P", t("H5P pokušaji"), t("H5P prosjek"), t("Etapne vježbe"), t("Pokušaji vježbi"), t("Prosjek vježbi")]} rows={rows} onOpen={onOpenStudent} emptyText={t("Nema učenika u grupi")} />
        <div className="rounded-2xl border border-border/50 bg-white p-4">
          <h4 className="mb-1 text-center font-extrabold text-foreground">{t("Gdje učenici griješe")}</h4>
          <p className="mb-3 text-center text-xs text-muted-foreground">{t("Pojedinačni odgovori na pitanja u lekcijama nisu završene vježbe.")}</p>
          {!interaktivni ? <Empty text={t("Odgovore na pitanja u lekcijama nije moguće učitati")} /> : !interaktivni.ukupnoPokusaja ? <Empty text={t("Još nema zabilježenih odgovora iz ugrađenih pitanja lekcija.")} /> : (
            <ul className="space-y-2">
              {interaktivni.pitanja.slice(0, 5).map((p, i) => (
                <ListItem key={i}><span className="font-bold">{p.pitanjeTekst}</span><span className="text-xs text-muted-foreground">{t("{n} pogrešnih od {ukupno}", { n: String(p.netacniPokusaji), ukupno: String(p.brojPokusaja) })}</span></ListItem>
              ))}
            </ul>
          )}
        </div>
      </>
    );
  } else if (section === "kvizovi") {
    const all = ucenici.flatMap(u => det.get(u.id)?.kvizovi ?? []);
    const rows: Row[] = ucenici.map(u => {
      const d = det.get(u.id);
      const k = d?.kvizovi ?? [];
      const uniq = new Set(k.map(x => x.kvizId)).size;
      return {
        id: u.id, ime: u.ime,
        cells: d ? [k.length, uniq, pct(avg(k.map(x => x.procenat))), k.reduce((s, x) => s + x.bodovi, 0)] : [u.kvizCount, dash, pct(u.kvizProsjecniProcenat), u.ukupnoBodova],
        detail: !d ? noDet : k.length === 0 ? <Empty text={t("Još nema riješenih kvizova")} /> : (
          <ul className="space-y-2">
            {k.map(x => (
              <ListItem key={x.id}>
                <span className="font-bold">{x.naslov}{x.nivo !== null ? ` · ${t("Nivo")} ${x.nivo}` : ""}</span>
                <span className="text-xs text-muted-foreground">{fmtDate(x.datum)} · {x.tacniOdgovori}/{x.ukupnoPitanja} · {pct(x.procenat)} · {x.bodovi} {t("bodova")}</span>
              </ListItem>
            ))}
          </ul>
        ),
      };
    });
    body = (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label={t("Pokušaja kvizova")} value={hasDet ? all.length : dash} />
          <Kpi label={t("Različitih kvizova")} value={hasDet ? new Set(all.map(x => x.kvizId)).size : dash} />
          <Kpi label={t("Prosječan rezultat")} value={hasDet ? pct(avg(all.map(x => x.procenat))) : dash} />
          <Kpi label={t("Bodova")} value={hasDet ? all.reduce((s, x) => s + x.bodovi, 0) : dash} />
        </div>
        <StudentTable title={t("Kvizovi po učeniku")} heads={[t("Pokušaji"), t("Različiti"), t("Prosjek"), t("Bodovi")]} rows={rows} onOpen={onOpenStudent} emptyText={t("Nema učenika u grupi")} />
      </>
    );
  } else if (section === "ocjene") {
    const rows: Row[] = ucenici.map(u => {
      const d = det.get(u.id);
      const subj = Object.entries(u.prosjecneOcjene ?? {});
      const brojNum = d ? d.ocjene.filter(o => o.ocjena !== null).length : null;
      const opisne = d ? d.ocjene.filter(o => o.ocjena === null && !!o.ocjenaOpisna).length : null;
      return {
        id: u.id, ime: u.ime,
        cells: [num(u.ukupnaProsjecna), brojNum ?? dash, opisne ?? dash],
        detail: (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">{t("Ocjene po predmetima")}</p>
              {subj.length === 0 ? <Empty text={t("Nema numeričkih ocjena")} /> : (
                <ul className="grid gap-2 sm:grid-cols-2">{subj.map(([p, v]) => <ListItem key={p}><span className="font-bold">{p}</span><span>{num(v.prosjek)} <span className="text-xs text-muted-foreground">({v.broj})</span></span></ListItem>)}</ul>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">{t("Historija ocjena")}</p>
              {!d ? noDet : d.ocjene.length === 0 ? <Empty text={t("Još nema ocjena")} /> : (
                <ul className="space-y-2">
                  {d.ocjene.map(o => (
                    <ListItem key={o.id}>
                      <span className="font-bold">{[o.predmet, o.lekcijaNaslov].filter(Boolean).join(" · ") || t("Ocjena")}: {o.ocjena !== null ? o.ocjena : o.ocjenaOpisna === "uradjeno" ? t("Urađeno") : o.ocjenaOpisna === "neuradjeno" ? t("Neurađeno") : (o.ocjenaOpisna ?? dash)}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(o.datum)}{o.napomena ? ` · ${o.napomena}` : ""}</span>
                    </ListItem>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ),
      };
    });
    body = (
      <>
        <div className="grid grid-cols-2 gap-3"><Kpi label={t("Prosjek grupe")} value={num(stat.grupaProsjekOcjena)} hint={t("samo numeričke ocjene")} /><Kpi label={t("Numeričkih ocjena")} value={hasDet ? ucenici.reduce((s, u) => s + (det.get(u.id)?.ocjene.filter(o => o.ocjena !== null).length ?? 0), 0) : dash} /></div>
        <StudentTable title={t("Ocjene po učeniku")} heads={[t("Prosjek"), t("Numeričkih"), t("Opisnih")]} rows={rows} onOpen={onOpenStudent} emptyText={t("Nema učenika u grupi")} />
      </>
    );
  } else {
    const rows: Row[] = ucenici.map(u => {
      const d = det.get(u.id);
      const pass = d ? d.etape.filter(e => e.polozeno).length : null;
      return {
        id: u.id, ime: u.ime,
        cells: [d ? d.etape.length : dash, pass ?? dash, d ? d.medaljoni.length : dash],
        detail: !d ? noDet : (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">{t("Etape")}</p>
              {d.etape.length === 0 ? <Empty text={t("Još nema pokušanih etapa")} /> : (
                <ul className="space-y-2">
                  {[...d.etape].sort((a, b) => a.nivo - b.nivo || a.redoslijed - b.redoslijed).map(e => (
                    <ListItem key={e.medaljonId}>
                      <span className="font-bold">{e.naziv} · {t("Nivo")} {e.nivo}</span>
                      <span className="text-xs text-muted-foreground">{e.polozeno ? t("Položeno") : t("Nije položeno")} · {e.brojPokusaja} {t("pokušaja")} · {t("najbolje")} {pct(e.najboljiProcenat)}</span>
                    </ListItem>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">{t("Osvojeni medaljoni")}</p>
              {d.medaljoni.length === 0 ? <Empty text={t("Još nema osvojenih medaljona")} /> : (
                <ul className="space-y-2">{d.medaljoni.map(m => <ListItem key={m.medaljonId}><span className="font-bold">{m.naziv} · {t("Nivo")} {m.nivo}</span><span className="text-xs text-muted-foreground">{fmtDate(m.datum)}</span></ListItem>)}</ul>
              )}
            </div>
          </div>
        ),
      };
    });
    const ds = ucenici.map(u => det.get(u.id)).filter((d): d is GroupStatisticsDetails => !!d);
    body = (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Kpi label={t("Pokušanih etapa")} value={hasDet ? ds.reduce((s, d) => s + d.etape.length, 0) : dash} />
          <Kpi label={t("Položenih etapa")} value={hasDet ? ds.reduce((s, d) => s + d.etape.filter(e => e.polozeno).length, 0) : dash} />
          <Kpi label={t("Osvojenih medaljona")} value={hasDet ? ds.reduce((s, d) => s + d.medaljoni.length, 0) : dash} />
        </div>
        <p className="text-center text-xs text-muted-foreground">{t("Zvjezdice muallima nisu osvojeni medaljoni.")}</p>
        <StudentTable title={t("Etape i medaljoni po učeniku")} heads={[t("Pokušano"), t("Položeno"), t("Medaljoni")]} rows={rows} onOpen={onOpenStudent} emptyText={t("Nema učenika u grupi")} />
      </>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted/30 p-1 sm:grid-cols-3" role="tablist">
        {tabs.map(v => (
          <button key={v.id} type="button" role="tab" aria-selected={section === v.id} onClick={() => setSection(v.id)} data-testid={`tab-stat-${v.id}`}
            className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-sm font-bold transition-all ${section === v.id ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <v.icon className="h-4 w-4 shrink-0" /> <span className="whitespace-normal text-center">{v.label}</span>
          </button>
        ))}
      </div>
      {body}
    </div>
  );
}
