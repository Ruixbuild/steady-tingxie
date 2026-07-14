"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TestCharQuiz from "./TestCharQuiz";
import { speak } from "@/lib/tts";
import { PASSAGE_PUNCTUATION } from "@/lib/testScoring";

type QuizChar = { globalIndex: number; char: string; clause: string };

type Props = {
  itemId: string;
  hanzi: string;
  hardMode: boolean;
  epochRef: { current: number };
  onDone: (result: {
    item_id: string;
    kind: "passage";
    totalChars: number;
    missedPositions: number[];
  }) => void;
};

// Blind: clauses are only ever spoken via TTS, never shown as text.
// missedPositions is keyed against Array.from(hanzi)'s global index
// (punctuation included in the count) so it aligns with mastery.char_misses
// for Reader (M5) to consume directly later.
export default function PassageSession({ itemId, hanzi, hardMode, epochRef, onDone }: Props) {
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
  const missedRef = useRef<number[]>([]);
  const lastClauseRef = useRef<string | null>(null);

  const current = quizChars[qIndex];

  useEffect(() => {
    if (!current) return;
    if (lastClauseRef.current !== current.clause) {
      lastClauseRef.current = current.clause;
      speak(current.clause);
    }
  }, [current]);

  function handleCharDone(result: { passed: boolean }) {
    if (!result.passed && current) {
      missedRef.current.push(current.globalIndex);
    }
    if (qIndex + 1 < quizChars.length) {
      setQIndex((i) => i + 1);
    } else {
      onDone({
        item_id: itemId,
        kind: "passage",
        totalChars: quizChars.length,
        missedPositions: missedRef.current,
      });
    }
  }

  if (!current) return null;

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => speak(current.clause)}
        className="btn btn-sm btn-secondary self-start"
      >
        🔊 Replay clause
      </button>

      <TestCharQuiz
        key={current.globalIndex}
        char={current.char}
        hardMode={hardMode}
        epochRef={epochRef}
        onDone={handleCharDone}
      />
    </div>
  );
}
