import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { translations, COUNTRY_TO_LANG, type Lang, type TranslationTree, getNestedValue } from "@/lib/i18n";
import sqFlat from "@/locales/sq.json";
import deFlat from "@/locales/de.json";
import enFlat from "@/locales/en.json";
import trFlat from "@/locales/tr.json";
import arFlat from "@/locales/ar.json";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: Record<string, string>) => string;
  tr: TranslationTree;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_KEY = "mekteb-lang";
const SUPPORTED: Lang[] = ["bs", "sq", "de", "en", "tr", "ar"];

/**
 * Flat izvor-tekst rječnici (generisani OpenAI pipelineom). Ključ je ili
 * dotted ključ (npr. "nav.pocetna") ili sam bosanski izvorni tekst
 * (npr. "Dodaj učenika"). Vrijednost je prijevod na taj jezik. Bosanski je
 * IZVOR pa nema svoj flat rječnik — uvijek se čita iz `translations.bs`.
 */
const FLAT: Partial<Record<Lang, Record<string, string>>> = {
  sq: sqFlat as Record<string, string>,
  de: deFlat as Record<string, string>,
  en: enFlat as Record<string, string>,
  tr: trFlat as Record<string, string>,
  ar: arFlat as Record<string, string>,
};

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

  useEffect(() => {
    clearGoogTransCookie();
  }, []);

  const setLang = useCallback((newLang: Lang) => {
    if (!SUPPORTED.includes(newLang)) return;
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch {
      // ignoriši
    }
  }, []);

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
        const dict = FLAT[lang];
        const flatHit = dict?.[key] ?? dict?.[bsValue];
        if (flatHit) {
          value = flatHit;
        } else {
          // Postojeća ručna nested struktura (de/en/tr/ar).
          const nested = getNestedValue(
            (translations as Record<string, unknown>)[lang] ?? {},
            key,
          );
          value = nested !== key ? nested : bsValue;
        }
      }

      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          value = value.split(`{${k}}`).join(v);
        });
      }
      return value;
    },
    [lang],
  );

  useEffect(() => {
    const isRTL = lang === "ar";
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tr, isRTL: lang === "ar" }}>
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
