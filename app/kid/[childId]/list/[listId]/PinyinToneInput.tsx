"use client";

import { useEffect, useRef, useState } from "react";
import { digitsToMarks } from "@/lib/pinyin";

const TONE_MARKS = ["ˉ", "ˊ", "ˇ", "ˋ"] as const;

type Props = {
  onChange: (value: string) => void;
  onEnter?: () => void;
  disabled?: boolean;
};

// Lets the child type pinyin letters only (no "ni3 hao3" digit typing) and
// pick each syllable's tone visually from the four tone-stroke shapes
// (plus neutral) instead of appending a number by hand.
export default function PinyinToneInput({ onChange, onEnter, disabled }: Props) {
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [pending, setPending] = useState("");
  const [awaitingTone, setAwaitingTone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onChange([...confirmed, pending].filter(Boolean).join(" "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed, pending]);

  function handleChange(raw: string) {
    const letters = raw.toLowerCase().replace(/[^a-zü]/g, "");
    setPending(letters);
  }

  function confirmWithTone(tone: 1 | 2 | 3 | 4) {
    if (!pending) return;
    const syllable = digitsToMarks(`${pending}${tone}`);
    setConfirmed((c) => [...c, syllable]);
    setPending("");
    setAwaitingTone(false);
    inputRef.current?.focus();
  }

  function removeChip(i: number) {
    setConfirmed((c) => c.filter((_, idx) => idx !== i));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (pending) setAwaitingTone(true);
      else if (e.key === "Enter") onEnter?.();
    } else if (e.key === "Backspace" && pending === "" && confirmed.length > 0) {
      e.preventDefault();
      setPending(confirmed[confirmed.length - 1].replace(/[āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ]/g, (m) => {
        const base: Record<string, string> = {
          ā: "a", á: "a", ǎ: "a", à: "a",
          ō: "o", ó: "o", ǒ: "o", ò: "o",
          ē: "e", é: "e", ě: "e", è: "e",
          ī: "i", í: "i", ǐ: "i", ì: "i",
          ū: "u", ú: "u", ǔ: "u", ù: "u",
          ǖ: "ü", ǘ: "ü", ǚ: "ü", ǜ: "ü",
        };
        return base[m] ?? m;
      }));
      setConfirmed((c) => c.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {confirmed.map((word, i) => (
          <button
            key={i}
            type="button"
            onClick={() => removeChip(i)}
            className="rounded-full px-3 py-1"
            style={{ background: "var(--accent-soft)", color: "var(--accent-d)", fontWeight: 700, fontSize: "1.3rem" }}
            title="Tap to remove"
          >
            {word} ✕
          </button>
        ))}
        <input
          ref={inputRef}
          value={pending}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || awaitingTone}
          placeholder={confirmed.length === 0 ? "type pinyin letters, e.g. ni" : ""}
          className="rounded-full border px-4 py-2 outline-none"
          style={{ borderColor: "var(--line)", color: "var(--ink)", minWidth: 120, fontSize: "1.6rem" }}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>

      {pending && !awaitingTone && (
        <button
          type="button"
          className="btn btn-sm btn-secondary self-start"
          onClick={() => setAwaitingTone(true)}
        >
          Pick tone for &quot;{pending}&quot; →
        </button>
      )}

      {awaitingTone && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm" style={{ color: "var(--mut)" }}>
            Tone for &quot;{pending}&quot;:
          </span>
          {TONE_MARKS.map((mark, i) => {
            const tone = (i + 1) as 1 | 2 | 3 | 4;
            return (
              <button
                key={tone}
                type="button"
                onClick={() => confirmWithTone(tone)}
                className="btn btn-sm btn-secondary"
                style={{ fontSize: "2.5rem", minWidth: 64, minHeight: 64 }}
              >
                {mark}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
