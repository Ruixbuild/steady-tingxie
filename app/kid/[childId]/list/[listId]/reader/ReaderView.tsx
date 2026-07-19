"use client";

import { useState } from "react";
import { PASSAGE_PUNCTUATION } from "@/lib/testScoring";
import { speakSequence, speakSequencePaused } from "@/lib/tts";
import PeekModal from "./PeekModal";
import TrickyCharPractice from "./TrickyCharPractice";

export default function ReaderView({
  hanzi,
  charMisses,
}: {
  hanzi: string;
  charMisses: Record<string, number>;
}) {
  const [peekChar, setPeekChar] = useState<string | null>(null);
  const [practising, setPractising] = useState(false);

  const chars = Array.from(hanzi);
  const trickyChars = chars.filter((ch, i) => !PASSAGE_PUNCTUATION.has(ch) && (charMisses[String(i)] ?? 0) > 0);

  if (practising) {
    return <TrickyCharPractice chars={trickyChars} onDone={() => setPractising(false)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => speakSequencePaused(chars, "zh-CN", 0.5, 350)}
          className="btn btn-sm btn-secondary"
        >
          🐢 Read full sentence
        </button>
        <button
          type="button"
          onClick={() => speakSequence(chars.slice(0, 2), "zh-CN", 0.6)}
          className="btn btn-sm btn-secondary"
        >
          🔊 Read first 2 words
        </button>
      </div>

      <p className="text-sm" style={{ color: "var(--mut)" }}>
        Tap a character to watch its stroke demonstration.
      </p>

      <p className="hanzi text-2xl leading-relaxed">
        {chars.map((ch, i) => {
          const isPunct = PASSAGE_PUNCTUATION.has(ch);
          const missed = (charMisses[String(i)] ?? 0) > 0;
          return (
            <span
              key={i}
              onClick={isPunct ? undefined : () => setPeekChar(ch)}
              style={{
                cursor: isPunct ? "default" : "pointer",
                textDecoration: missed ? "underline" : "none",
                textDecorationColor: "var(--warn)",
                textDecorationThickness: 3,
              }}
            >
              {ch}
            </span>
          );
        })}
      </p>

      {trickyChars.length > 0 && (
        <button type="button" onClick={() => setPractising(true)} className="btn btn-primary self-start">
          Practise my tricky characters
        </button>
      )}

      {peekChar && <PeekModal char={peekChar} onClose={() => setPeekChar(null)} />}
    </div>
  );
}
