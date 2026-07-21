"use client";

import { useMemo, useRef, useState } from "react";
import TestCharQuiz from "./TestCharQuiz";
import { speak, speakSequence, PHRASE_RATE } from "@/lib/tts";
import type { ItemResult } from "@/lib/testTypes";

type QuizChar = { globalIndex: number; char: string };

type Props = {
  itemId: string;
  hanzi: string;
  hardMode: boolean;
  /** "full" offers a replay-the-whole-sentence button plus a manual
   * "Hear it again" per character. "first2" offers only a replay-first-2
   * button, with no per-character replay — a harder, closer-to-blind
   * variant. Neither mode auto-plays on entry or per character; playback
   * is always child-initiated. */
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
            onClick={() => speak(hanzi, "zh-CN", PHRASE_RATE)}
            className="btn btn-sm btn-secondary"
          >
            🐢 Read full sentence
          </button>
        ) : (
          <button
            type="button"
            onClick={() => speakSequence(quizChars.slice(0, 2).map((c) => c.char), "zh-CN", PHRASE_RATE)}
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
        silent
        hideReplayButton={reveal === "first2"}
        hardMode={hardMode}
        epochRef={epochRef}
        onDone={handleCharDone}
      />
    </div>
  );
}
