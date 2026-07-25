"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TestCharQuiz from "./TestCharQuiz";
import {
  isSilentOnEntry,
  prefetchItem,
  replayItem,
  replayItemOpening,
} from "@/lib/narration";
import type { ItemResult } from "@/lib/testTypes";

type QuizChar = { globalIndex: number; char: string };

type Props = {
  itemId: string;
  hanzi: string;
  hardMode: boolean;
  /** "full" offers a replay-the-whole-sentence button. "first2" offers
   * only a replay-first-2 button — a harder, closer-to-blind variant.
   * Neither mode has a per-character "Hear it again" (removed — a blind
   * 默写 test shouldn't let the child replay the exact character they're
   * about to write). Neither mode auto-plays on entry or per character;
   * playback is always child-initiated. */
  reveal: "full" | "first2";
  epochRef: { current: number };
  onDone: (result: Extract<ItemResult, { kind: "passage" }>) => void;
};

// Blind: the sentence is only ever spoken via TTS, never shown as text.
// globalIndex is keyed against Array.from(hanzi)'s index (punctuation
// included) so it aligns with mastery.char_misses for Reader (M5).
export default function PassageSession({ itemId, hanzi, hardMode, reveal, epochRef, onDone }: Props) {
  // Every character counts as its own box, punctuation included, so the
  // box count matches the sentence's visible length (e.g. "我的家！" = 4).
  const quizChars = useMemo<QuizChar[]>(
    () => Array.from(hanzi).map((char, globalIndex) => ({ globalIndex, char })),
    [hanzi]
  );

  const [qIndex, setQIndex] = useState(0);
  const charsRef = useRef<{ globalIndex: number; strokes: number; totalMistakes: number }[]>([]);

  // A blind mo xie test never auto-plays, but the child almost always taps
  // one of the read buttons within a second or two — and that first tap
  // otherwise pays a full cold /api/tts round-trip. Warming the clip on
  // entry moves that wait into time the child spends reading the screen.
  useEffect(() => {
    prefetchItem("passage", "test", hanzi);
  }, [hanzi]);

  const current = quizChars[qIndex];

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
      <div className="flex gap-3 flex-wrap">
        {reveal === "full" ? (
          <button
            type="button"
            onClick={() => replayItem("passage", hanzi)}
            className="btn btn-sm btn-secondary"
          >
            🐢 Read full sentence
          </button>
        ) : (
          <button
            type="button"
            onClick={() => replayItemOpening("passage", hanzi, 2)}
            className="btn btn-sm btn-secondary"
          >
            🔊 Read first 2 words
          </button>
        )}
      </div>

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
        kind="passage"
        // Derived from the narration policy table rather than hardcoded, so
        // "is mo xie silent during a test?" has exactly one answer in one
        // place instead of living as a bare prop here.
        silent={isSilentOnEntry("passage", "test")}
        hideReplayButton
        hardMode={hardMode}
        epochRef={epochRef}
        onDone={handleCharDone}
      />
    </div>
  );
}
