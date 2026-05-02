import { createContext, useContext, useEffect, ReactNode, useCallback } from "react";
import { translations, type Lang, type TranslationTree, getNestedValue } from "@/lib/i18n";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: Record<string, string>) => string;
  tr: TranslationTree;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

/**
 * Brisanje googtrans cookie-a — robusno preko svih varijanti koje Google
 * može da je postavio (host-only, sa hostname-om, sa .hostname-om).
 *
 * VAŽNO za migraciju: postojeći produkcijski korisnici mogu imati keširan
 * `googtrans=/bs/en` (ili sl.) cookie iz prethodne verzije app-a. Bez
 * aktivnog brisanja, čak i nakon što izbacimo Google Translate widget,
 * stari Service Worker / browser cache može i dalje učitavati script
 * koji čita cookie i pravi konfuziju. Briše se idempotentno na svaki
 * mount LanguageProvider-a.
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

/**
 * Multi-language podrška je PRIVREMENO ISKLJUČENA — app je locked na
 * bosanski jezik. Razlog: Google Translate prevodi sadržaj baze su davali
 * neuredan rezultat (poseban tekst arapskog pisma, miješanje stilova,
 * itd.), pa smo radije ostavili samo bosanski dok ne uradimo pravi
 * server-side multi-jezik (faza nakon mobile launch-a).
 *
 * Šta i dalje radi:
 *   - `useLanguage()` hook
 *   - `t("key")` funkcija — uvijek čita iz `translations.bs`
 *   - `tr` direktan pristup tree-u
 *
 * Šta NE radi:
 *   - `setLang(...)` — no-op (zadržan u API-ju za backward compat sa
 *     postojećim pozivima u kodu, da ne moramo brisati 100+ poziva)
 *   - `lang` — uvijek vraća "bs"
 *   - `isRTL` — uvijek false
 *
 * Kad bude vrijeme za vraćanje multi-language podrške, vrati prethodnu
 * verziju iz git history-ja (commit prije ove izmjene).
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang: Lang = "bs";

  // Migracioni cleanup: očisti googtrans cookie i ostali state vezan za
  // staru multi-jezik logiku, jednom po mount-u. Idempotentno.
  useEffect(() => {
    clearGoogTransCookie();
    try {
      // Nije strogo potrebno, ali oslobađa storage i osigurava da kod
      // ne stane na stari sačuvani jezik ako se ikad vrati.
      localStorage.removeItem("mekteb-lang");
      sessionStorage.removeItem("mekteb-translate-reload-for");
    } catch {
      // Privatni mode / blokiran storage — ignoriši.
    }
  }, []);

  const setLang = useCallback((_newLang: Lang) => {
    // No-op: jezik je locked na "bs". API zadržan radi backward kompatibilnosti
    // sa postojećim komponentama koje pozivaju setLang (npr. budući picker).
  }, []);

  const tr: TranslationTree = translations.bs;

  const t = useCallback((key: string, params?: Record<string, string>) => {
    let value = getNestedValue(tr, key);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, v);
      });
    }
    return value;
  }, [tr]);

  useEffect(() => {
    document.documentElement.dir = "ltr";
    document.documentElement.lang = "bs";
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tr, isRTL: false }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
