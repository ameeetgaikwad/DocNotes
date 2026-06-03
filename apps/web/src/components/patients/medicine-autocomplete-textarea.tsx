"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { ComponentProps } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface MedicineHint {
  phrase: string;
  count: number;
}

interface Props extends Omit<ComponentProps<typeof Textarea>, "onChange"> {
  value: string;
  onChange: (next: string) => void;
  hints: ReadonlyArray<MedicineHint>;
  maxSuggestions?: number;
}

function findCurrentWordStart(value: string, caret: number): number {
  let start = caret;
  while (start > 0) {
    const ch = value[start - 1];
    if (ch === " " || ch === "\n" || ch === "\t") break;
    start--;
  }
  return start;
}

export const MedicineAutocompleteTextarea = forwardRef<
  HTMLTextAreaElement,
  Props
>(function MedicineAutocompleteTextarea(
  { value, onChange, hints, maxSuggestions = 6, className, ...textareaProps },
  forwardedRef,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(forwardedRef, () => textareaRef.current!, []);

  const [caret, setCaret] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const [open, setOpen] = useState(false);

  const wordStart = findCurrentWordStart(value, caret);
  const currentWord = value.slice(wordStart, caret);
  // Skip the suggestion popup when the user is typing a number (dosage,
  // tablet count, days, etc.) — medicine names don't start with digits,
  // so this avoids noise while writing prescriptions (Manoj msg 1321).
  const isNumericWord = /^\d/.test(currentWord);

  const matches =
    open && currentWord.length >= 2 && !isNumericWord
      ? hints
          .filter((h) => {
            const p = h.phrase.toLowerCase();
            const w = currentWord.toLowerCase();
            return p.startsWith(w) && p !== w;
          })
          .slice(0, maxSuggestions)
      : [];

  function applyHint(phrase: string) {
    const before = value.slice(0, wordStart);
    const after = value.slice(caret);
    const needsSpace = !after.startsWith(" ") && !after.startsWith("\n");
    const insertion = needsSpace ? `${phrase} ` : phrase;
    const next = before + insertion + after;
    onChange(next);
    const newCaret = wordStart + insertion.length;
    setOpen(false);
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(newCaret, newCaret);
        setCaret(newCaret);
      }
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
    // Enter and Tab fall through to default behaviour (newline / focus
    // shift) — never auto-apply a suggestion. Manoj msg 1431 hit the
    // old behaviour: typing "Thigh pain" then hitting Enter for a new
    // line silently swapped his text for whatever "Pain in abdomen…"
    // happened to be the top match. Suggestions now apply ONLY via
    // explicit click / tap.
  }

  useEffect(() => {
    setActiveIdx(0);
  }, [currentWord]);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        onClick={(e) =>
          setCaret((e.target as HTMLTextAreaElement).selectionStart)
        }
        onKeyUp={(e) =>
          setCaret((e.target as HTMLTextAreaElement).selectionStart)
        }
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
        }}
        className={className}
        {...textareaProps}
      />
      {matches.length > 0 && (
        <div className="absolute inset-x-0 z-20 mt-1 overflow-hidden rounded-md border bg-popover shadow-md">
          {matches.map((m, i) => (
            <button
              key={m.phrase}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyHint(m.phrase)}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-accent",
                i === activeIdx && "bg-accent",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{m.phrase}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                ×{m.count}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
