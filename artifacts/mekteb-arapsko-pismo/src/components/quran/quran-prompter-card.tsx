import { useState } from "react";
import { BookOpenCheck, ExternalLink, Mic } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PROMPTER_URL = "https://prompter.alketab.app/en/";

const modes = [
  {
    name: "Reading",
    title: "Čitanje",
    detail: "Za redovno učenje iz Mushafa. Prepozna suru, prati riječi, ne prekida se tokom pauze i nastavlja na sljedeću suru. Pamti gdje si stao/la.",
  },
  {
    name: "Recognize",
    title: "Prepoznavanje",
    detail: "Počni od bilo kojeg ajeta. Nakon pauze ponovo pronalazi tvoje mjesto i prati te čak i kada pređeš na drugu suru.",
  },
  {
    name: "Praying",
    title: "Namaz",
    detail: "Kao prepoznavanje, ali nakon pauze prvo traži El-Fatihu. Namijenjeno učenju naglas na početku svakog rekata.",
  },
  {
    name: "Review",
    title: "Ponavljanje",
    detail: "Za provjeru hifza. Riječi su skrivene, a otkrivaju se jednu po jednu dok ih učiš.",
  },
];

export function QuranPrompterCard() {
  const [open, setOpen] = useState(false);

  return (
    <section className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5" aria-labelledby="prompter-heading">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 id="prompter-heading" className="text-lg font-extrabold text-foreground">Glasovno praćenje Kur'ana</h2>
          <p className="mt-0.5 text-sm font-bold text-primary">Uputstvo – pročitati prije pokretanja</p>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        U prozoru koji se otvori izaberi mod, dozvoli pristup mikrofonu i počni učiti. Pri prvoj posjeti sačekaj da se model preuzme.
        Prikaz je na engleskom, a arapski tekst Kur'ana ostaje na arapskom.
      </p>

      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {modes.map((mode, index) => (
          <li key={mode.name} className="rounded-xl border border-primary/10 bg-white p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">{index + 1}</span>
              <h3 className="text-sm font-extrabold text-foreground">{mode.title} <span className="font-semibold text-muted-foreground">({mode.name})</span></h3>
            </div>
            <p className="mt-1.5 pl-8 text-xs leading-relaxed text-muted-foreground">{mode.detail}</p>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          data-testid="open-quran-prompter"
        >
          <Mic className="h-4 w-4" aria-hidden="true" />
          Pokreni glasovno praćenje
        </button>
        <span className="text-xs text-muted-foreground">
          Vanjska usluga Al-Ketab · <a className="underline hover:text-primary" href={PROMPTER_URL} target="_blank" rel="noopener noreferrer">otvori direktno <ExternalLink className="inline h-3 w-3" aria-hidden="true" /></a>
        </span>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[1200px] flex-col gap-2 overflow-hidden rounded-xl p-2 sm:h-[calc(100dvh-2rem)] sm:p-3">
          <DialogHeader className="shrink-0 pr-8 text-left">
            <DialogTitle className="text-base">Quran Prompter</DialogTitle>
            <DialogDescription className="text-xs">
              Ako mikrofon ne radi u ovom prozoru, <a href={PROMPTER_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">otvori u zasebnoj kartici</a>.
            </DialogDescription>
          </DialogHeader>
          {open && (
            <iframe
              title="Quran Prompter – glasovno praćenje Kur'ana"
              src={PROMPTER_URL}
              allow="microphone; autoplay"
              className="min-h-0 w-full flex-1 rounded-lg border-0 bg-black"
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}