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
 * Brisanje googtrans cookie-a — robusno preko svih varijanti koje Google
 * može da je postavio. Bez ovog, vraćanje na bs (default, bez prevoda) NE
 * radi pouzdano: max-age=0 sa praznim value-om često ne briše cookie ako
 * je domain/path mismatch, pa Google widget i dalje čita stari `/bs/en`
 * cookie i ponovo prevodi na engleski nakon reloada.
 *
 * Šaljemo expires u prošlosti (najpouzdaniji metod brisanja) za sve
 * kombinacije: bez domena (host-only), sa hostname-om, sa .hostname-om.
 */
function clearGoogTransCookie(): void {
  const PAST = "expires=Thu, 01 Jan 1970 00:00:00 GMT";
  const host = window.location.hostname;
  const dotHost = host.startsWith(".") ? host : `.${host}`;
  const domains = ["", `; domain=${host}`, `; domain=${dotHost}`];
  for (const d of domains) {
    document.cookie = `googtrans=; path=/; ${PAST}${d}`;
  }
}

/**
 * Postavlja Google Translate `googtrans` cookie za prijevod sa bs na <target>.
 * Format: `/bs/<dst>`. Za bs (default, bez prevoda) zovemo robusno brisanje
 * preko `clearGoogTransCookie()`. Postavljamo i `host` i `.host` varijantu
 * jer Google čita oboje, zavisno od domene.
 *
 * Vraća true ako se efektivna vrijednost cookie-a promijenila (znak da
 * treba reload da Google widget primijeni novo stanje).
 */
function setGoogTransCookie(target: Lang): boolean {
  const value = target === "bs" ? "" : `/bs/${target}`;
  const current = (document.cookie.match(/(?:^|;\s*)googtrans=([^;]*)/)?.[1]) || "";
  if (current === value) return false;

  if (target === "bs") {
    clearGoogTransCookie();
    return true;
  }

  const host = window.location.hostname;
  const dotHost = host.startsWith(".") ? host : `.${host}`;
  const expires = `expires=${new Date(Date.now() + 365 * 24 * 3600 * 1000).toUTCString()}`;
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
      // Defenzivno: validiraj da spremljena vrijednost odgovara podržanom
      // jeziku prije postavljanja Google Translate cookie-a — invalidan
      // localStorage entry ne smije izazvati nepotreban reload sa pogrešnim
      // cookie-em.
      if (saved && saved in translations) {
        const savedLang = saved as Lang;
        if (savedLang !== "bs" && setGoogTransCookie(savedLang)) {
          safeReloadForLang(savedLang);
          return;
        }
        // Defenzivno: ako je trenutni jezik bs, osiguraj da je cookie
        // stvarno obrisan i da Google ne pokušava prevod sa starog cookie-a
        // koji je možda zaostao iz prethodnog reload ciklusa. Bez reloada —
        // samo cleanup; ako je cookie već prazan, no-op. Takođe brišemo
        // reload-guard session key da stale guard iz prethodnog jezika ne
        // bi blokirao kasniju potrebnu reload akciju u istom tabu.
        if (savedLang === "bs") {
          clearGoogTransCookie();
          try {
            sessionStorage.removeItem("mekteb-translate-reload-for");
          } catch {
            // sessionStorage može throw-ati u Safari private mode / kad
            // je storage onemogućen — guard cleanup je best-effort, nije
            // kritičan za korektnost (samo defenzivni reset).
          }
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
