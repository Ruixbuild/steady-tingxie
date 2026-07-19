"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TestCharQuiz from "./TestCharQuiz";
import { speak, speakSequencePaused } from "@/lib/tts";
import { PASSAGE_PUNCTUATION } from "@/lib/testScoring";
import type { ItemResult } from "@/lib/testTypes";

type QuizChar = { globalIndex: number; char: string; clause: string };

type Props = {
  itemId: string;
  hanzi: string;
  hardMode: boolean;
  /** "full" reads the whole sentence upfront (and lets the child replay it
   * any time) before/while quizzing every character. "first2" only reads
   * the first two characters once, with no further hints, before quizzing
   * every character — a harder, closer-to-blind variant. */
  reveal: "full" | "first2";
  epochRef: { current: number };
  onDone: (result: Extract<ItemResult, { kind: "passage" }>) => void;
};

// Blind: clauses are only ever spoken via TTS, never shown as text.
// missedPositions is keyed against Array.from(hanzi)'s global index
// (punctuation included in the count) so it aligns with mastery.char_misses
// for Reader (M5) to consume directly later.
export default function PassageSession({ itemId, hanzi, hardMode, reveal, epochRef, onDone }: Props) {
  const quizChars = useMemo<QuizChar[]>(() => {
    const clauses = hanzi.split(/(?<=[，。！？；、])/).filter(Boolean);
    const result: QuizChar[] = [];
    let globalIndex = 0;
    for (const clause of clauses) {
      for (const ch of Array.from(clause)) {
        if (!PASSAGE_PUNCTUATION.has(ch)) {
          result.push({ globalIndex, char: ch, clause });
        }
        globalIndex++;
      }
    }
    return result;
  }, [hanzi]);

  const [qIndex, setQIndex] = useState(0);
  const charsRef = useRef<{ globalIndex: number; strokes: number; totalMistakes: number }[]>([]);
  const lastClauseRef = useRef<string | null>(null);

  const current = quizChars[qIndex];

  // Runs once per passage item (the parent gives this component a fresh
  // `key` per item) — the upfront reveal read, before any per-character
  // quizzing starts.
  useEffect(() => {
    if (reveal === "full") {
      speakSequencePaused(Array.from(hanzi), "zh-CN", 0.6, 300);
    } else {
      speakSequencePaused(quizChars.slice(0, 2).map((c) => c.char), "zh-CN", 0.6, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!current) return;
    // Only "full" mode gets a spoken hint as each new clause is reached —
    // "first2" must stay silent past its initial two-character reveal.
    if (reveal !== "full") return;
    if (lastClauseRef.current !== current.clause) {
      lastClauseRef.current = current.clause;
      speak(current.clause, "zh-CN", 0.75);
    }
  }, [current, reveal]);

  function handleCharDone(result: { strokes: number; totalMistakes: number }) {
    if (current) {
      charsRef.current.push({ globalIndex: current.globalIndex, ...result });
    }
    if (qIndex + 1 < quizChars.length) {
      setQIndex((i) => i + 1);
    } else {
      onDone({
        item_id: itemId,
        kind: "passage",
        chars: charsRef.current,
      });
    }
  }

  if (!current) return null;

  return (
    <div className="flex flex-col gap-4">
      {reveal === "full" && (
        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => speakSequencePaused(Array.from(hanzi), "zh-CN", 0.6, 300)}
            className="btn btn-sm btn-secondary"
          >
            🐢 Play whole sentence again
          </button>
          <button
            type="button"
            onClick={() => speak(current.clause, "zh-CN", 0.75)}
            className="btn btn-sm btn-secondary"
          >
            🔊 Replay clause
          </button>
        </div>
      )}

      <div className="flex gap-2 justify-center flex-wrap">
        {quizChars.map((qc, i) => {
          const done = i < qIndex;
          const on = i === qIndex;
          return (
            <span
              key={qc.globalIndex}
              className="hanzi flex items-center justify-center"
              style={{
                minWidth: 44,
                height: 44,
                fontSize: "1.3rem",
                borderRadius: 12,
                border: `1.5px solid ${on ? "var(--accent)" : done ? "var(--ok)" : "var(--line)"}`,
                background: on ? "var(--accent-soft)" : done ? "var(--ok-soft)" : "#fff",
                color: on ? "var(--accent-d)" : "var(--ink)",
              }}
            >
              {done ? qc.char : ""}
            </span>
          );
        })}
      </div>

      <TestCharQuiz
        key={current.globalIndex}
        char={current.char}
        silent={reveal === "first2" && qIndex >= 2}
        hardMode={hardMode}
        epochRef={epochRef}
        onDone={handleCharDone}
      />
    </div>
  );
}
