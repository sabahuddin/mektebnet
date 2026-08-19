/**
 * LessonPause — student-facing interactive pause blocks embedded in lesson HTML.
 *
 * Embedded as: <div data-lesson-pause="1" data-pause-config="ENCODED_JSON"></div>
 * where ENCODED_JSON = encodeURIComponent(JSON.stringify(config))
 *
 * Canonical schema
 * ────────────────
 * Common fields (all types):
 *   id                  string          unique block id
 *   type                PauseType
 *   question            string          the question shown to the student
 *   correctExplanation  string?         shown on correct answer
 *   wrongExplanation    string?         shown on wrong answer
 *
 * yes-no:
 *   correctAnswer       boolean         true → Da, false → Ne
 *
 * multiple-choice:
 *   options             string[]        answer choices
 *   correctOption       number          0-based index of correct choice
 *
 * fact-question:
 *   options             string[]        answer choices (scored like multiple-choice)
 *   correctOption       number          0-based index of correct choice
 *   fact                string?         context fact shown ABOVE the question
 *
 * matching:
 *   pairs               {left,right}[]  correct pairings
 *
 * ordering:
 *   items               string[]        items in correct order; shuffled on render
 */

import { useState, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  ArrowUpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Canonical config types
// ─────────────────────────────────────────────

export type PauseType =
  | "yes-no"
  | "multiple-choice"
  | "fact-question"
  | "matching"
  | "ordering";

interface BaseConfig {
  id: string;
  type: PauseType;
  question: string;
  correctExplanation?: string;
  wrongExplanation?: string;
}

export interface YesNoConfig extends BaseConfig {
  type: "yes-no";
  /** true = "Da" is correct, false = "Ne" is correct */
  correctAnswer: boolean;
}

export interface MultipleChoiceConfig extends BaseConfig {
  type: "multiple-choice";
  options: string[];
  /** 0-based index into options */
  correctOption: number;
}

export interface FactQuestionConfig extends BaseConfig {
  type: "fact-question";
  /** Contextual fact displayed above the question */
  fact?: string;
  options: string[];
  /** 0-based index into options */
  correctOption: number;
}

export interface MatchingConfig extends BaseConfig {
  type: "matching";
  pairs: Array<{ left: string; right: string }>;
}

export interface OrderingConfig extends BaseConfig {
  type: "ordering";
  /** items in correct order; shuffled on first render */
  items: string[];
}

export type PauseConfig =
  | YesNoConfig
  | MultipleChoiceConfig
  | FactQuestionConfig
  | MatchingConfig
  | OrderingConfig;

// ─────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────

export function parsePauseConfig(encoded: string): PauseConfig | null {
  try {
    const json = decodeURIComponent(encoded);
    const obj = JSON.parse(json);
    if (!obj || typeof obj.type !== "string") return null;
    return obj as PauseConfig;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Scroll helper — finds last meaningful element
// inside the preceding segment rather than its top
// ─────────────────────────────────────────────

/** Selectors for "meaningful" content elements, in priority order. */
const MEANINGFUL_SELECTORS = [
  "p",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  ".arabic-card",
  ".info-box",
  ".lesson-text",
  "figure",
  "table",
].join(", ");

function scrollToLastMeaningfulElement(
  segRef: React.RefObject<HTMLDivElement | null>,
) {
  const container = segRef.current;
  if (!container) return;
  const all = container.querySelectorAll<HTMLElement>(MEANINGFUL_SELECTORS);
  if (all.length > 0) {
    const last = all[all.length - 1];
    last.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    // Fallback: scroll to container top
    container.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// ─────────────────────────────────────────────
// Shared feedback area
// ─────────────────────────────────────────────

function Feedback({
  correct,
  explanation,
  textRef,
  onRetry,
}: {
  correct: boolean;
  explanation?: string;
  textRef?: React.RefObject<HTMLDivElement | null>;
  onRetry: () => void;
}) {
  const scrollToText = useCallback(() => {
    if (textRef) scrollToLastMeaningfulElement(textRef);
  }, [textRef]);

  return (
    <div
      className={cn(
        "mt-4 rounded-2xl border px-4 py-3 text-sm leading-relaxed",
        correct
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-900",
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        {correct ? (
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
        ) : (
          <XCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold mb-0.5">{correct ? "Tačno! ✓" : "Nije tačno."}</p>
          {explanation && (
            <p className="text-xs opacity-90 leading-relaxed">{explanation}</p>
          )}
        </div>
      </div>

      {!correct && (
        <div className="mt-3 flex flex-wrap gap-2">
          {textRef && (
            <button
              type="button"
              onClick={scrollToText}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
              data-testid="button-scroll-to-relevant"
            >
              <ArrowUpCircle className="w-3.5 h-3.5 shrink-0" />
              Vrati se na relevantni tekst
            </button>
          )}
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            data-testid="button-retry-pause"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Pokušaj ponovo
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Option button (shared by MC and Fact)
// ─────────────────────────────────────────────

function OptionButton({
  label,
  index,
  selected,
  correctOption,
  submitted,
  onClick,
}: {
  label: string;
  index: number;
  selected: number | null;
  correctOption: number;
  submitted: boolean;
  onClick: () => void;
}) {
  const isChosen = selected === index;
  const isCorrect = index === correctOption;

  const stateClass =
    !submitted
      ? "border-border bg-white hover:border-teal-400 hover:bg-teal-50 active:scale-[0.99]"
      : isCorrect
        ? "border-emerald-500 bg-emerald-50 text-emerald-800 font-bold"
        : isChosen
          ? "border-red-400 bg-red-50 text-red-700"
          : "border-border bg-white opacity-40";

  return (
    <button
      type="button"
      disabled={submitted}
      onClick={onClick}
      className={cn(
        "text-left px-4 py-3 rounded-2xl border-2 font-medium text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400",
        stateClass,
      )}
      data-testid={`button-option-${index}`}
    >
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────
// Yes / No
// ─────────────────────────────────────────────

function YesNoBlock({
  config,
  textRef,
}: {
  config: YesNoConfig;
  textRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [chosen, setChosen] = useState<boolean | null>(null);

  const submitted = chosen !== null;
  const correct = submitted && chosen === config.correctAnswer;

  const retry = () => setChosen(null);

  const optionClass = (opt: boolean) => {
    if (!submitted)
      return "border-border bg-white hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700 active:scale-95";
    if (opt === config.correctAnswer)
      return "border-emerald-500 bg-emerald-50 text-emerald-800";
    if (chosen === opt) return "border-red-400 bg-red-50 text-red-700";
    return "border-border bg-white opacity-40";
  };

  return (
    <div>
      <p className="font-semibold text-foreground mb-3 leading-relaxed">
        {config.question}
      </p>
      <div className="flex gap-3">
        {([true, false] as const).map((opt) => (
          <button
            key={String(opt)}
            type="button"
            disabled={submitted}
            onClick={() => setChosen(opt)}
            className={cn(
              "flex-1 py-3 rounded-2xl border-2 font-bold text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400",
              optionClass(opt),
            )}
            data-testid={`button-yes-no-${opt ? "yes" : "no"}`}
          >
            {opt ? "Da" : "Ne"}
          </button>
        ))}
      </div>
      {submitted && (
        <Feedback
          correct={correct}
          explanation={correct ? config.correctExplanation : config.wrongExplanation}
          textRef={correct ? undefined : textRef}
          onRetry={retry}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Multiple Choice (scored)
// ─────────────────────────────────────────────

function MultipleChoiceBlock({
  config,
  textRef,
}: {
  config: MultipleChoiceConfig;
  textRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  const submitted = selected !== null;
  const correct = submitted && selected === config.correctOption;

  const retry = () => setSelected(null);

  return (
    <div>
      <p className="font-semibold text-foreground mb-3 leading-relaxed">
        {config.question}
      </p>
      <div className="flex flex-col gap-2">
        {config.options.map((opt, idx) => (
          <OptionButton
            key={idx}
            label={opt}
            index={idx}
            selected={selected}
            correctOption={config.correctOption}
            submitted={submitted}
            onClick={() => setSelected(idx)}
          />
        ))}
      </div>
      {submitted && (
        <Feedback
          correct={correct}
          explanation={correct ? config.correctExplanation : config.wrongExplanation}
          textRef={correct ? undefined : textRef}
          onRetry={retry}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Fact Question (fact shown first, then scored MC)
// ─────────────────────────────────────────────

function FactQuestionBlock({
  config,
  textRef,
}: {
  config: FactQuestionConfig;
  textRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  const submitted = selected !== null;
  const correct = submitted && selected === config.correctOption;

  const retry = () => setSelected(null);

  return (
    <div>
      {/* Fact context shown above question */}
      {config.fact && (
        <div className="mb-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm text-teal-900 leading-relaxed">
          <span className="font-bold text-teal-700 mr-1">ℹ️ Znaj:</span>
          {config.fact}
        </div>
      )}

      <p className="font-semibold text-foreground mb-3 leading-relaxed">
        {config.question}
      </p>

      <div className="flex flex-col gap-2">
        {config.options.map((opt, idx) => (
          <OptionButton
            key={idx}
            label={opt}
            index={idx}
            selected={selected}
            correctOption={config.correctOption}
            submitted={submitted}
            onClick={() => setSelected(idx)}
          />
        ))}
      </div>

      {submitted && (
        <Feedback
          correct={correct}
          explanation={correct ? config.correctExplanation : config.wrongExplanation}
          textRef={correct ? undefined : textRef}
          onRetry={retry}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Matching (select-based, touch + keyboard)
// ─────────────────────────────────────────────

function MatchingBlock({
  config,
  textRef,
}: {
  config: MatchingConfig;
  textRef: React.RefObject<HTMLDivElement | null>;
}) {
  const rights = config.pairs.map((p) => p.right);

  // Shuffle right-column options once on mount
  const [shuffledRights] = useState<string[]>(() =>
    [...rights].sort(() => Math.random() - 0.5),
  );

  const [selections, setSelections] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const allSelected = config.pairs.every((_, i) => selections[i] !== undefined && selections[i] !== "");
  const numCorrect = submitted
    ? config.pairs.filter((p, i) => selections[i] === p.right).length
    : 0;
  const allCorrect = submitted && numCorrect === config.pairs.length;

  const retry = () => {
    setSelections({});
    setSubmitted(false);
  };

  return (
    <div>
      <p className="font-semibold text-foreground mb-3 leading-relaxed">
        {config.question}
      </p>

      <div className="flex flex-col gap-2">
        {config.pairs.map((pair, i) => {
          const chosen = selections[i];
          const isCorrect = submitted && chosen === pair.right;
          const isWrong = submitted && chosen !== pair.right;
          return (
            <div
              key={i}
              className={cn(
                "grid grid-cols-2 gap-2 p-3 rounded-2xl border-2 transition-colors",
                !submitted
                  ? "border-border bg-white"
                  : isCorrect
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-red-300 bg-red-50",
              )}
            >
              <div className="flex items-center text-sm font-medium leading-snug pr-1">
                {pair.left}
              </div>
              <Select
                disabled={submitted}
                value={selections[i] ?? ""}
                onValueChange={(val) =>
                  setSelections((prev) => ({ ...prev, [i]: val }))
                }
              >
                <SelectTrigger
                  className={cn(
                    "h-9 text-sm rounded-xl",
                    submitted && isCorrect && "border-emerald-500 text-emerald-800",
                    submitted && isWrong && "border-red-400 text-red-700",
                  )}
                  data-testid={`select-matching-${i}`}
                >
                  <SelectValue placeholder="Odaberi..." />
                </SelectTrigger>
                <SelectContent>
                  {shuffledRights.map((r, ri) => (
                    <SelectItem key={ri} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      {!submitted && (
        <Button
          type="button"
          size="sm"
          disabled={!allSelected}
          onClick={() => setSubmitted(true)}
          className="mt-3 rounded-xl"
          data-testid="button-submit-matching"
        >
          Provjeri parove
        </Button>
      )}

      {submitted && (
        <Feedback
          correct={allCorrect}
          explanation={
            allCorrect
              ? config.correctExplanation
              : config.wrongExplanation
                ? `${config.wrongExplanation} (${numCorrect}/${config.pairs.length} tačnih)`
                : `${numCorrect}/${config.pairs.length} parova tačno.`
          }
          textRef={allCorrect ? undefined : textRef}
          onRetry={retry}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Ordering (up/down buttons, touch + keyboard)
// ─────────────────────────────────────────────

function OrderingBlock({
  config,
  textRef,
}: {
  config: OrderingConfig;
  textRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [items, setItems] = useState<string[]>(() =>
    [...config.items].sort(() => Math.random() - 0.5),
  );
  const [submitted, setSubmitted] = useState(false);

  const allCorrect =
    submitted && items.every((it, i) => it === config.items[i]);

  const move = (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  };

  const retry = () => {
    setItems([...config.items].sort(() => Math.random() - 0.5));
    setSubmitted(false);
  };

  return (
    <div>
      <p className="font-semibold text-foreground mb-3 leading-relaxed">
        {config.question}
      </p>

      <div className="flex flex-col gap-2" role="list">
        {items.map((item, i) => {
          const isCorrect = submitted && item === config.items[i];
          const isWrong = submitted && item !== config.items[i];
          return (
            <div
              key={item}
              role="listitem"
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-2xl border-2 bg-white transition-colors",
                !submitted
                  ? "border-border"
                  : isCorrect
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-red-300 bg-red-50",
              )}
            >
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  disabled={submitted || i === 0}
                  onClick={() => move(i, -1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-border/70 bg-white hover:bg-muted disabled:opacity-25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                  aria-label={`Pomjeri "${item}" gore`}
                  data-testid={`button-order-up-${i}`}
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={submitted || i === items.length - 1}
                  onClick={() => move(i, 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-border/70 bg-white hover:bg-muted disabled:opacity-25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                  aria-label={`Pomjeri "${item}" dolje`}
                  data-testid={`button-order-down-${i}`}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                {i + 1}
              </span>

              <span className="flex-1 text-sm font-medium leading-snug">
                {item}
              </span>

              {submitted &&
                (isCorrect ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                ))}
            </div>
          );
        })}
      </div>

      {!submitted && (
        <Button
          type="button"
          size="sm"
          onClick={() => setSubmitted(true)}
          className="mt-3 rounded-xl"
          data-testid="button-submit-ordering"
        >
          Provjeri redoslijed
        </Button>
      )}

      {submitted && (
        <Feedback
          correct={allCorrect}
          explanation={allCorrect ? config.correctExplanation : config.wrongExplanation}
          textRef={allCorrect ? undefined : textRef}
          onRetry={retry}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Type label map
// ─────────────────────────────────────────────

const TYPE_LABEL: Record<PauseType, string> = {
  "yes-no": "Da / Ne",
  "multiple-choice": "Višestruki izbor",
  "fact-question": "Provjeri znanje",
  matching: "Spoji parove",
  ordering: "Poredaj redoslijedom",
};

// ─────────────────────────────────────────────
// Main LessonPause wrapper
// ─────────────────────────────────────────────

export interface LessonPauseProps {
  /** Raw encoded config from data-pause-config attribute */
  encodedConfig: string;
  /** Ref to the immediately-preceding text segment DOM node */
  precedingTextRef: React.RefObject<HTMLDivElement | null>;
}

export function LessonPause({ encodedConfig, precedingTextRef }: LessonPauseProps) {
  const config = parsePauseConfig(encodedConfig);
  if (!config) return null;

  return (
    <div
      className="my-5 rounded-2xl border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 shadow-sm overflow-hidden"
      data-testid="lesson-pause-block"
      data-pause-id={config.id}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-teal-500/10 border-b border-teal-200">
        <span className="text-base" aria-hidden="true">⏸</span>
        <span className="text-xs font-extrabold text-teal-800 uppercase tracking-wide">
          Pauza za provjeru — {TYPE_LABEL[config.type]}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-4">
        {config.type === "yes-no" && (
          <YesNoBlock config={config} textRef={precedingTextRef} />
        )}
        {config.type === "multiple-choice" && (
          <MultipleChoiceBlock config={config} textRef={precedingTextRef} />
        )}
        {config.type === "fact-question" && (
          <FactQuestionBlock config={config} textRef={precedingTextRef} />
        )}
        {config.type === "matching" && (
          <MatchingBlock config={config} textRef={precedingTextRef} />
        )}
        {config.type === "ordering" && (
          <OrderingBlock config={config} textRef={precedingTextRef} />
        )}
      </div>
    </div>
  );
}
