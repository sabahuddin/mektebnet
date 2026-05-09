import { useLocation } from "wouter";
import { ArrowLeft, Sparkles } from "lucide-react";

// Privremena placeholder stranica za Nivo 2.
// Korisnik završi svih 64 lekcije Nivoa 1, klikne Vrata i stigne ovdje.
// Pravi sadržaj Nivoa 2 dolazi kasnije.
export default function Nivo2UskoroPage() {
  const [, setLocation] = useLocation();
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-amber-200 via-amber-100 to-yellow-50 flex flex-col items-center justify-center px-6 text-center">
      <button
        onClick={() => setLocation("/nivo1-mapa")}
        className="absolute top-3 left-3 px-3 py-2 rounded-full bg-white/95 shadow-md flex items-center gap-2 text-amber-900 font-bold active:scale-95"
        data-testid="button-nazad-na-mapu"
      >
        <ArrowLeft className="w-5 h-5" /> Mapa
      </button>

      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-200 via-amber-400 to-orange-500 ring-4 ring-white shadow-2xl flex items-center justify-center mb-6 animate-pulse">
        <Sparkles className="w-12 h-12 text-white drop-shadow" strokeWidth={2.5} />
      </div>

      <h1 className="text-2xl sm:text-3xl font-extrabold text-amber-900 mb-3">
        Mašallah! Završio si Nivo 1.
      </h1>
      <p className="text-amber-800 max-w-sm mb-6">
        Vrata u Nivo 2 ti se uskoro otvaraju. Radimo na novim lekcijama —
        vrati se uskoro!
      </p>

      <button
        onClick={() => setLocation("/ilmihal")}
        className="px-5 py-3 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold shadow-lg active:scale-95"
        data-testid="button-nazad-na-ilmihal"
      >
        Nazad na Ilmihal
      </button>
    </div>
  );
}
