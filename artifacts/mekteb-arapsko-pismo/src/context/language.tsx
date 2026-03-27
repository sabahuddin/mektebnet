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
          }
        })
        .catch(() => {})
        .finally(() => { clearTimeout(timeoutId); setGeoDetected(true); });
    }
  }, []);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    try { localStorage.setItem("mekteb-lang", newLang); } catch {}
  }, []);

  const tr = translations[lang] || translations.bs;

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
