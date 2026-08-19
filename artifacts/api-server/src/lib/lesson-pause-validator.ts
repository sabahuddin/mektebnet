/**
 * Validator za Ilmihal lekcijske pauze ugrađene u contentHtml.
 *
 * Svaka pauza ima oblik:
 *   <div data-lesson-pause="1" data-pause-config="ENCODED_JSON"></div>
 * gdje je ENCODED_JSON = encodeURIComponent(JSON.stringify(config))
 *
 * Podržani tipovi:
 *   yes-no          — tačno/netačno pitanje
 *   multiple-choice — višestruki izbor
 *   fact-question   — poput multiple-choice + činjenica
 *   matching        — spajanje parova
 *   ordering        — redoslijed stavki
 *
 * Sva polja correctExplanation i wrongExplanation su OBAVEZNA i neprazna za
 * sve tipove. Opcije/parovi/stavke moraju biti između 2 i 10 komada i
 * međusobno jedinstven (trimovano) kako bi se izbjegao dvosmislen UI.
 */

export type PauseValidationError = {
  pauseIndex: number;
  pauseId: string | null;
  message: string;
};

export type PauseValidationResult =
  | { ok: true }
  | { ok: false; errors: PauseValidationError[] };

// ── Konstante ────────────────────────────────────────────────────────────────

const MAX_QUESTION_LEN = 500;
const MAX_EXPLANATION_LEN = 1000;
const MAX_OPTION_LEN = 300;
const MAX_FACT_LEN = 1000;
const MAX_ITEM_LEN = 300;
const MAX_LEFT_LEN = 200;
const MAX_RIGHT_LEN = 200;
const MIN_CHOICES = 2;  // min opcija/parova/stavki
const MAX_OPTIONS = 10;
const MAX_PAIRS = 10;
const MAX_ITEMS = 10;
const MAX_ID_LEN = 100;

const KNOWN_TYPES = new Set([
  "yes-no",
  "multiple-choice",
  "fact-question",
  "matching",
  "ordering",
]);

// ── Pomoćne funkcije ─────────────────────────────────────────────────────────

function trimmedNonEmpty(val: unknown, label: string, maxLen: number, errs: string[]): string | null {
  if (typeof val !== "string") {
    errs.push(`"${label}" mora biti tekst.`);
    return null;
  }
  const v = val.trim();
  if (!v) {
    errs.push(`"${label}" ne smije biti prazan.`);
    return null;
  }
  if (v.length > maxLen) {
    errs.push(`"${label}" je predugačak (max ${maxLen} znakova).`);
    return null;
  }
  return v;
}

/** Validira obavezna polja za objašnjenja (ista za svih 5 tipova). */
function validateExplanations(cfg: Record<string, unknown>, errs: string[]): void {
  trimmedNonEmpty(cfg.correctExplanation, "correctExplanation", MAX_EXPLANATION_LEN, errs);
  trimmedNonEmpty(cfg.wrongExplanation, "wrongExplanation", MAX_EXPLANATION_LEN, errs);
}

// ── Validatori po tipu ───────────────────────────────────────────────────────

function validateYesNo(cfg: Record<string, unknown>, errs: string[]): void {
  trimmedNonEmpty(cfg.question, "question", MAX_QUESTION_LEN, errs);
  if (typeof cfg.correctAnswer !== "boolean") {
    errs.push('"correctAnswer" mora biti boolean (true/false).');
  }
  validateExplanations(cfg, errs);
}

function validateMultipleChoice(cfg: Record<string, unknown>, errs: string[]): void {
  trimmedNonEmpty(cfg.question, "question", MAX_QUESTION_LEN, errs);

  if (!Array.isArray(cfg.options)) {
    errs.push('"options" mora biti niz.');
  } else {
    if (cfg.options.length < MIN_CHOICES) {
      errs.push(`"options" mora imati najmanje ${MIN_CHOICES} stavke.`);
    }
    if (cfg.options.length > MAX_OPTIONS) {
      errs.push(`"options" smije imati najviše ${MAX_OPTIONS} stavki.`);
    }
    // Validacija svakog stringa i jedinstvenost (trimovano)
    const seenOptions = new Set<string>();
    cfg.options.forEach((o: unknown, i: number) => {
      const v = trimmedNonEmpty(o, `options[${i}]`, MAX_OPTION_LEN, errs);
      if (v !== null) {
        if (seenOptions.has(v)) {
          errs.push(`"options[${i}]" ("${v}") se ponavlja — opcije moraju biti jedinstvene.`);
        } else {
          seenOptions.add(v);
        }
      }
    });
  }

  const numOptions = Array.isArray(cfg.options) ? cfg.options.length : 0;
  if (
    typeof cfg.correctOption !== "number" ||
    !Number.isInteger(cfg.correctOption) ||
    cfg.correctOption < 0 ||
    (numOptions > 0 && cfg.correctOption >= numOptions)
  ) {
    errs.push('"correctOption" mora biti validan indeks u "options" nizu.');
  }

  validateExplanations(cfg, errs);
}

function validateFactQuestion(cfg: Record<string, unknown>, errs: string[]): void {
  // Isto kao multiple-choice (uključujući obavezna objašnjenja) + obavezno "fact" polje.
  // Pozivamo validateMultipleChoice koji već poziva validateExplanations.
  validateMultipleChoice(cfg, errs);
  trimmedNonEmpty(cfg.fact, "fact", MAX_FACT_LEN, errs);
}

function validateMatching(cfg: Record<string, unknown>, errs: string[]): void {
  trimmedNonEmpty(cfg.question, "question", MAX_QUESTION_LEN, errs);

  if (!Array.isArray(cfg.pairs)) {
    errs.push('"pairs" mora biti niz.');
  } else {
    if (cfg.pairs.length < MIN_CHOICES) {
      errs.push(`"pairs" mora imati najmanje ${MIN_CHOICES} para.`);
    }
    if (cfg.pairs.length > MAX_PAIRS) {
      errs.push(`"pairs" smije imati najviše ${MAX_PAIRS} parova.`);
    }
    // Jedinstvenost desne strane sprečava dvosmislen UI (učenik ne može razlikovati)
    const seenRight = new Set<string>();
    cfg.pairs.forEach((p: unknown, i: number) => {
      if (typeof p !== "object" || p === null || Array.isArray(p)) {
        errs.push(`"pairs[${i}]" mora biti objekat sa "left" i "right".`);
      } else {
        const pair = p as Record<string, unknown>;
        trimmedNonEmpty(pair.left, `pairs[${i}].left`, MAX_LEFT_LEN, errs);
        const rv = trimmedNonEmpty(pair.right, `pairs[${i}].right`, MAX_RIGHT_LEN, errs);
        if (rv !== null) {
          if (seenRight.has(rv)) {
            errs.push(`"pairs[${i}].right" ("${rv}") se ponavlja — desne vrijednosti parova moraju biti jedinstvene.`);
          } else {
            seenRight.add(rv);
          }
        }
      }
    });
  }

  validateExplanations(cfg, errs);
}

function validateOrdering(cfg: Record<string, unknown>, errs: string[]): void {
  trimmedNonEmpty(cfg.question, "question", MAX_QUESTION_LEN, errs);

  if (!Array.isArray(cfg.items)) {
    errs.push('"items" mora biti niz.');
  } else {
    if (cfg.items.length < MIN_CHOICES) {
      errs.push(`"items" mora imati najmanje ${MIN_CHOICES} stavke.`);
    }
    if (cfg.items.length > MAX_ITEMS) {
      errs.push(`"items" smije imati najviše ${MAX_ITEMS} stavki.`);
    }
    // Jedinstvenost stavki — duplicate bi učinile slaganje besmislenim
    const seenItems = new Set<string>();
    cfg.items.forEach((item: unknown, i: number) => {
      const v = trimmedNonEmpty(item, `items[${i}]`, MAX_ITEM_LEN, errs);
      if (v !== null) {
        if (seenItems.has(v)) {
          errs.push(`"items[${i}]" ("${v}") se ponavlja — stavke moraju biti jedinstvene.`);
        } else {
          seenItems.add(v);
        }
      }
    });
  }

  validateExplanations(cfg, errs);
}

// ── Parsiranje jedne pauze ───────────────────────────────────────────────────

/**
 * Izvuče sve data-pause-config atribute iz HTML-a.
 * Vraća niz parova [encodedConfig, pauseIndex].
 */
function extractPauseConfigs(html: string): Array<{ encoded: string; index: number }> {
  const result: Array<{ encoded: string; index: number }> = [];
  // Tražimo data-lesson-pause atribut kao marker, pa data-pause-config na istom tagu
  const tagRe = /<div\b[^>]*data-lesson-pause\s*=\s*["'][^"']*["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = tagRe.exec(html)) !== null) {
    const tag = m[0];
    // Izvuci data-pause-config vrijednost (može biti s jednostrukim ili dvostrukim navodnicima)
    const cfgM = tag.match(/\bdata-pause-config\s*=\s*"([^"]*)"/i)
      || tag.match(/\bdata-pause-config\s*=\s*'([^']*)'/i);
    const encoded = cfgM ? cfgM[1] : "";
    result.push({ encoded, index: idx++ });
  }
  return result;
}

// ── Javna funkcija ───────────────────────────────────────────────────────────

/**
 * Validira sve lekcijske pauze ugrađene u contentHtml.
 *
 * Greška se vraća ako:
 *   - data-pause-config nedostaje ili nije valjano enkodiran
 *   - JSON nije objekat
 *   - id nedostaje, nije string, ili se ponavlja unutar lekcije
 *   - type nedostaje ili nije jedan od poznatih tipova
 *   - Polja specifična za tip nisu ispravna
 *   - correctExplanation ili wrongExplanation nedostaju ili su prazni
 *   - options/pairs/items imaju < 2 ili > 10 unosa, ili duplikate
 */
export function validateLessonPauses(html: string): PauseValidationResult {
  if (!html || typeof html !== "string") return { ok: true };

  const pauses = extractPauseConfigs(html);
  if (pauses.length === 0) return { ok: true };

  const allErrors: PauseValidationError[] = [];
  const seenIds = new Set<string>();

  for (const { encoded, index } of pauses) {
    const errs: string[] = [];
    let pauseId: string | null = null;

    // 1. Dekodiranje
    let cfg: Record<string, unknown>;
    try {
      if (!encoded) throw new Error("Nedostaje data-pause-config atribut.");
      const json = decodeURIComponent(encoded);
      const parsed = JSON.parse(json);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("Konfiguracija mora biti JSON objekat.");
      }
      cfg = parsed as Record<string, unknown>;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Neispravna konfiguracija pauze.";
      allErrors.push({ pauseIndex: index, pauseId: null, message: `Pauza #${index + 1}: ${msg}` });
      continue;
    }

    // 2. id
    if (typeof cfg.id !== "string" || !cfg.id.trim()) {
      errs.push('"id" mora biti neprazan string.');
    } else {
      pauseId = cfg.id.trim();
      if (pauseId.length > MAX_ID_LEN) {
        errs.push(`"id" je predugačak (max ${MAX_ID_LEN} znakova).`);
        pauseId = pauseId.slice(0, MAX_ID_LEN); // za prikaz
      }
      if (seenIds.has(pauseId)) {
        errs.push(`"id" "${pauseId}" se ponavlja unutar lekcije — svaka pauza mora imati jedinstven id.`);
      } else {
        seenIds.add(pauseId);
      }
    }

    // 3. type
    const type = typeof cfg.type === "string" ? cfg.type.trim() : null;
    if (!type) {
      errs.push('"type" mora biti neprazan string.');
    } else if (!KNOWN_TYPES.has(type)) {
      errs.push(`Nepoznat tip pauze: "${type}". Dozvoljeni tipovi: ${[...KNOWN_TYPES].join(", ")}.`);
    } else {
      // 4. Validacija specifična za tip
      switch (type) {
        case "yes-no":
          validateYesNo(cfg, errs);
          break;
        case "multiple-choice":
          validateMultipleChoice(cfg, errs);
          break;
        case "fact-question":
          validateFactQuestion(cfg, errs);
          break;
        case "matching":
          validateMatching(cfg, errs);
          break;
        case "ordering":
          validateOrdering(cfg, errs);
          break;
      }
    }

    if (errs.length > 0) {
      const label = pauseId ? `Pauza "${pauseId}"` : `Pauza #${index + 1}`;
      allErrors.push({
        pauseIndex: index,
        pauseId,
        message: `${label}: ${errs.join(" ")}`,
      });
    }
  }

  if (allErrors.length > 0) return { ok: false, errors: allErrors };
  return { ok: true };
}
