import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { translations, type Lang, type TranslationTree, getNestedValue, COUNTRY_TO_LANG } from "@/lib/i18n";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: Record<string, string>) => string;
  tr: TranslationTree;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

/**
 * Postavlja Google Translate `googtrans` cookie. Cookie ima format `/<src>/<dst>`,
 * gdje je <src> izvorni jezik (bs, jer je sav sadržaj u bazi na bosanskom) i
 * <dst> ciljni jezik na koji widget treba prevesti stranicu. Za bs (default,
 * bez prevoda) cookie brišemo (prazna vrijednost + max-age=0). Postavljamo i
 * `host` i `.host` varijantu jer Google čita oboje, zavisno od domene.
 *
 * Vraća true ako se cookie stvarno promijenio (znak da treba reload).
 */
function setGoogTransCookie(target: Lang): boolean {
  const value = target === "bs" ? "" : `/bs/${target}`;
  const current = (document.cookie.match(/(?:^|;\s*)googtrans=([^;]*)/)?.[1]) || "";
  if (current === value) return false;

  const host = window.location.hostname;
  const dotHost = host.startsWith(".") ? host : `.${host}`;
  const expires = value
    ? `expires=${new Date(Date.now() + 365 * 24 * 3600 * 1000).toUTCString()}`
    : "max-age=0";
  document.cookie = `googtrans=${value}; path=/; ${expires}`;
  document.cookie = `googtrans=${value}; path=/; domain=${dotHost}; ${expires}`;
  return true;
}

/**
 * Reload-guard: spriječava beskonačnu petlju kad browser ne dozvoljava upis
 * `googtrans` cookie-a (private mode, blokirani 3rd-party cookies, neka
 * korporativna policy). Bez ovog guarda, useEffect bi nakon svakog reloada
 * vidio neusklađen cookie i opet pozvao `window.location.reload()`.
 *
 * Strategija: za dati ciljni jezik uradimo najviše JEDAN reload po sesiji
 * (tab-life). Ako i nakon reloada cookie nije postavljen, batnemo se i samo
 * zadržimo i18n UI prevod — Google Translate sloj jednostavno neće biti
 * aktivan. Korisnik i dalje može ručno odabrati jezik (i ako i tada cookie
 * fail-uje, isti guard spriječava petlju).
 */
function safeReloadForLang(target: Lang): void {
  const KEY = "mekteb-translate-reload-for";
  try {
    if (sessionStorage.getItem(KEY) === target) {
      // Već smo reloadali jednom za ovaj jezik u ovoj sesiji; ne pokušavaj opet.
      return;
    }
    sessionStorage.setItem(KEY, target);
  } catch {
    // sessionStorage nedostupan (vrlo restriktivni browser) — bolje preskočiti
    // reload nego rizikovati petlju.
    return;
  }
  window.location.reload();
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem("mekteb-lang");
      if (saved && saved in translations) return saved as Lang;
    } catch {}
    return "bs";
  });

  const [geoDetected, setGeoDetected] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mekteb-lang");
      if (saved) {
        // Prvi mount: ako spremljeni jezik nije bs i cookie ne odgovara,
        // postavi cookie i pokušaj reload (uz guard koji spriječava petlju
        // kad je cookie write blokiran).
        if (saved !== "bs" && setGoogTransCookie(saved as Lang)) {
          safeReloadForLang(saved as Lang);
          return;
        }
        setGeoDetected(true);
        return;
      }
    } catch {}

    if (!geoDetected) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      fetch("https://ipapi.co/json/", { signal: controller.signal })
        .then(r => r.json())
        .then(data => {
          const country = data?.country_code || data?.country;
          if (country && COUNTRY_TO_LANG[country]) {
            const detected = COUNTRY_TO_LANG[country];
            setLangState(detected);
            try { localStorage.setItem("mekteb-lang", detected); } catch {}
            // Auto-detected jezik koji nije bs zahtijeva Google translate
            // aktivaciju — postavi cookie pa reload (sa guardom).
            if (detected !== "bs" && setGoogTransCookie(detected)) {
              safeReloadForLang(detected);
            }
          }
        })
        .catch(() => {})
        .finally(() => { clearTimeout(timeoutId); setGeoDetected(true); });
    }
  }, []);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    try { localStorage.setItem("mekteb-lang", newLang); } catch {}
    // Manuelni odabir jezika: postavi/brisi googtrans cookie i reload.
    // Reload je intruzivan ali jedini pouzdan način da Google Translate
    // ponovo prevede cijelu SPA stranicu na novi jezik (njegov MutationObserver
    // ne pokriva pouzdano route promjene u SPA). Resetujemo guard ovdje
    // jer je ovo eksplicitna korisnička akcija — guard je samo protiv
    // automatskih (mount-time) petlji.
    if (setGoogTransCookie(newLang)) {
      try { sessionStorage.removeItem("mekteb-translate-reload-for"); } catch {}
      safeReloadForLang(newLang);
    }
  }, []);

  const tr: TranslationTree = translations[lang] || translations.bs;

  const t = useCallback((key: string, params?: Record<string, string>) => {
    let value = getNestedValue(tr, key);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, v);
      });
    }
    return value;
  }, [tr]);

  const isRTL = lang === "ar";

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang, isRTL]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tr, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
