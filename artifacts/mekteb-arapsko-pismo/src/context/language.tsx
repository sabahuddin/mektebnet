import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { translations, COUNTRY_TO_LANG, type Lang, type TranslationTree, getNestedValue } from "@/lib/i18n";
import { getApiBase } from "@/lib/api";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: Record<string, string>) => string;
  tr: TranslationTree;
  isRTL: boolean;
  /** Ponovo učitaj UI override-e iz baze (npr. nakon admin izmjene prijevoda). */
  reloadUiOverrides: () => Promise<void>;
}

/** Runtime override mapa: { jezik: { kljuc(bosanski izvor): prijevod } }. */
type UiOverrides = Partial<Record<Lang, Record<string, string>>>;

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_KEY = "mekteb-lang";
const SUPPORTED: Lang[] = ["bs", "sq", "de", "en", "tr", "ar"];

/**
 * Lazy cache za flat rječnike — učitava se SAMO kad korisnik odabere taj jezik.
 * Bosanski je izvor, nema flat rječnik. Ostali jezici se code-splituju u
 * posebne Vite chunkove (~150-190 KB svaki) i skidaju samo na zahtjev.
 */
const flatCache: Partial<Record<Lang, Record<string, string>>> = {};

async function loadFlatDict(lang: Lang): Promise<Record<string, string>> {
  if (flatCache[lang]) return flatCache[lang]!;
  const mods: Record<string, () => Promise<{ default: Record<string, string> }>> = {
    sq: () => import("@/locales/sq.json"),
    de: () => import("@/locales/de.json"),
    en: () => import("@/locales/en.json"),
    tr: () => import("@/locales/tr.json"),
    ar: () => import("@/locales/ar.json"),
  };
  const loader = mods[lang];
  if (!loader) return {};
  const m = await loader();
  flatCache[lang] = m.default;
  return m.default;
}

/**
 * Brisanje starog googtrans cookie-a iz prethodne (Google Translate) verzije,
 * idempotentno na mount. Bez ovoga stari Service Worker / cache može učitati
 * skriptu koja čita cookie i pravi konfuziju u prikazu.
 */
function clearGoogTransCookie(): void {
  if (typeof document === "undefined") return;
  const PAST = "expires=Thu, 01 Jan 1970 00:00:00 GMT";
  const host = window.location.hostname;
  const dotHost = host.startsWith(".") ? host : `.${host}`;
  const domains = ["", `; domain=${host}`, `; domain=${dotHost}`];
  for (const d of domains) {
    document.cookie = `googtrans=; path=/; ${PAST}${d}`;
  }
}

function detectInitialLang(): Lang {
  if (typeof window === "undefined") return "bs";
  // Default je BOSANSKI (primarna platforma). Drugi jezik se aktivira SAMO
  // ručnim izborom u prekidaču, koji se pamti u localStorage. Namjerno NE
  // koristimo navigator.language da ne prebacimo bosansku dijasporu (engleski
  // browser) na strani jezik bez njihove odluke.
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved as Lang)) return saved as Lang;
  } catch {
    // privatni mode / blokiran storage
  }
  return "bs";
}

/**
 * Prevodni sloj:
 *   - `lang` je trenutni jezik (persistira u localStorage).
 *   - `t(key)` traži prijevod ovim redom:
 *       1) bosanski izvor (dotted ključ iz `translations.bs` ILI sam tekst),
 *       2) flat rječnik za jezik (dotted ključ ili izvorni tekst),
 *       3) postojeća nested struktura `translations[lang]` (de/en/tr/ar),
 *       4) fallback na bosanski izvor.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang);
  const [overrides, setOverrides] = useState<UiOverrides>({});
  // Flat rječnik za aktivni jezik — lazy učitan iz posebnog Vite chunka.
  // Za bosanski je uvijek {} (BS je izvor, nema prijevoda).
  const [flatDict, setFlatDict] = useState<Record<string, string>>(
    () => flatCache[detectInitialLang()] ?? {}
  );
  const queryClient = useQueryClient();

  // Učitaj flat rječnik kad se jezik promijeni (ili na startu za ne-BS lang).
  useEffect(() => {
    if (lang === "bs") { setFlatDict({}); return; }
    let cancelled = false;
    loadFlatDict(lang).then(dict => {
      if (!cancelled) setFlatDict(dict);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [lang]);

  const reloadUiOverrides = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/content/ui-prijevodi`);
      if (!res.ok) return;
      const data = (await res.json()) as UiOverrides;
      setOverrides(prev => {
        if (!data || typeof data !== "object") return prev;
        // Preskači re-render ako su overrides prazni (nema admin izmjena).
        const hasAny = Object.values(data).some(d => d && Object.keys(d).length > 0);
        if (!hasAny) return prev;
        // Preskači re-render ako se sadržaj nije promijenio.
        if (JSON.stringify(data) === JSON.stringify(prev)) return prev;
        return data;
      });
    } catch {
      // mreža/offline — zadrži bundlane prijevode
    }
  }, []);

  useEffect(() => {
    clearGoogTransCookie();
    void reloadUiOverrides();
  }, [reloadUiOverrides]);

  const setLang = useCallback((newLang: Lang) => {
    if (!SUPPORTED.includes(newLang) || newLang === lang) return;
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch {
      // ignoriši
    }
    // Sadržaj (ilmihal/knjige/rječnik/kvizovi/misije/medaljoni/igre) dohvaća se
    // sa X-Lang headerom. Pri promjeni jezika invalidiraj keš da se prevedeni
    // sadržaj ponovo dohvati (UI tekstovi se mijenjaju reaktivno preko t()).
    queryClient.invalidateQueries();
  }, [lang, queryClient]);

  const tr: TranslationTree =
    ((translations as Record<string, unknown>)[lang] as TranslationTree | undefined) ??
    translations.bs;

  const t = useCallback(
    (key: string, params?: Record<string, string>) => {
      // 1) Bosanski izvor: dotted ključ ako postoji, inače sam tekst.
      const bsValue = getNestedValue(translations.bs, key);

      let value: string;
      if (lang === "bs") {
        value = bsValue;
      } else {
        // 0) Runtime override iz baze (admin uređivanje) — ima prednost nad svim.
        const ov = overrides[lang];
        const ovHit = ov?.[key] ?? ov?.[bsValue];
        if (ovHit) {
          value = ovHit;
        } else {
          // 1) Lazy-učitani flat rječnik za ovaj jezik.
          const flatHit = flatDict[key] ?? flatDict[bsValue];
          if (flatHit) {
            value = flatHit;
          } else {
            // 2) Postojeća ručna nested struktura (de/en/tr/ar) kao zadnji fallback.
            const nested = getNestedValue(
              (translations as Record<string, unknown>)[lang] ?? {},
              key,
            );
            value = nested !== key ? nested : bsValue;
          }
        }
      }

      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          value = value.split(`{${k}}`).join(v);
        });
      }
      return value;
    },
    [lang, overrides, flatDict],
  );

  useEffect(() => {
    const isRTL = lang === "ar";
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tr, isRTL: lang === "ar", reloadUiOverrides }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

export { COUNTRY_TO_LANG };
