"use client";

// 识读 test quiz — selection-based, used for both formats:
// - Level 1 "listen & pick": promptAudio is the target word, no promptText.
// - Level 2 "match the pairing": promptText is the pairing with the target
//   word blanked out (e.g. "＿节目"), no auto-playing promptAudio.
// Correctness is a plain equality check the client can determine safely —
// same trust level TingXie already gives its own pinyin items (see
// lib/supabase/revision_test.sql's header comment).

import { useEffect, useState, type CSSProperties } from "react";
import { speakRevision } from "@/lib/revision/narration";

export type ReadQuizOption = { id: string; hanzi: string };

type Props = {
  targetId: string;
  options: ReadQuizOption[];
  promptAudio?: string;
  promptText?: string;
  onDone: (passed: boolean) => void;
};

export default function TestReadQuiz({ targetId, options, promptAudio, promptText, onDone }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    // Resetting local selection state when the target changes (parent
    // advances the queue) is the intended synchronization here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(null);
    if (promptAudio) speakRevision(promptAudio);
  }, [targetId, promptAudio]);

  function handlePick(id: string) {
    if (selectedId) return;
    setSelectedId(id);
    setTimeout(() => onDone(id === targetId), 900);
  }

  return (
    <div className="flex flex-col gap-4 items-center">
      {promptAudio && (
        <button type="button" onClick={() => speakRevision(promptAudio)} className="btn btn-secondary">
          🔊 Say it again
        </button>
      )}
      {promptText && <p className="hanzi text-3xl font-extrabold text-center">{promptText}</p>}

      <div className="flex flex-wrap gap-3 justify-center mt-2">
        {options.map((opt) => {
          const isSelected = selectedId === opt.id;
          const isCorrect = opt.id === targetId;
          const revealed = selectedId !== null;
          let style: CSSProperties = {
            border: "1.5px solid var(--line)",
            background: "#fff",
            color: "var(--ink)",
          };
          if (revealed && isCorrect) {
            style = { border: "1.5px solid var(--ok)", background: "var(--ok-soft)", color: "#1D6E47" };
          } else if (revealed && isSelected && !isCorrect) {
            style = { border: "1.5px solid var(--miss)", background: "var(--miss-soft)", color: "var(--miss)" };
          }
          return (
            <button
              key={opt.id}
              type="button"
              disabled={revealed}
              onClick={() => handlePick(opt.id)}
              className="hanzi text-xl font-semibold"
              style={{ ...style, borderRadius: 16, padding: "14px 22px" }}
            >
              {opt.hanzi}
            </button>
          );
        })}
      </div>
    </div>
  );
}
