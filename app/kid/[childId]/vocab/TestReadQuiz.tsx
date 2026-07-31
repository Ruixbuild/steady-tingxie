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
  /** The un-blanked pairing to reveal (and read aloud) once the child has
   * picked an answer, instead of auto-advancing after a fixed delay — used
   * by 识读 Level 2's fill-in-the-blank format so the child actually gets
   * to read/hear the completed phrase and taps "Next" when ready, rather
   * than the answer flashing by for 900ms. Level 1 passes no fullPhrase
   * and keeps the original auto-advance timing. */
  fullPhrase?: string;
  onDone: (passed: boolean) => void;
};

export default function TestReadQuiz({ targetId, options, promptAudio, promptText, fullPhrase, onDone }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    // Resetting local selection state when the target changes (parent
    // advances the queue) is the intended synchronization here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(null);
    if (promptAudio) speakRevision(promptAudio);
  }, [targetId, promptAudio]);

  const revealed = selectedId !== null;
  const passed = selectedId === targetId;

  function handlePick(id: string) {
    if (selectedId) return;
    setSelectedId(id);
    if (fullPhrase) {
      speakRevision(fullPhrase);
    } else {
      setTimeout(() => onDone(id === targetId), 900);
    }
  }

  return (
    <div className="flex flex-col gap-4 items-center">
      {promptAudio && (
        <button type="button" onClick={() => speakRevision(promptAudio)} className="btn btn-secondary">
          🔊 Say it again
        </button>
      )}
      {promptText && !(fullPhrase && revealed) && (
        <p className="hanzi text-3xl font-extrabold text-center">{promptText}</p>
      )}
      {fullPhrase && revealed && (
        <div className="flex flex-col gap-2 items-center">
          <p className="hanzi text-3xl font-extrabold text-center">{fullPhrase}</p>
          <button type="button" onClick={() => speakRevision(fullPhrase)} className="btn btn-secondary">
            🔊 Say it again
          </button>
        </div>
      )}

      <div
        className="w-full mt-2"
        style={{
          display: "grid",
          // A fixed 2 columns (wrapping into 2 rows for the usual 4
          // options) instead of one column per option: forcing every
          // option into a single row squeezed each one into a narrow
          // sliver, which only got worse once distractors started
          // matching the target's character length (pickReadDistractors)
          // — a 4-character target now means every option is a similarly
          // long word, cramped and hard to read at 4-across. Two columns
          // gives each option roughly double the width.
          gridTemplateColumns: `repeat(${Math.min(2, Math.max(options.length, 1))}, 1fr)`,
          gap: 8,
        }}
      >
        {options.map((opt) => {
          const isSelected = selectedId === opt.id;
          const isCorrect = opt.id === targetId;
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
              className="hanzi font-bold"
              style={{
                ...style,
                borderRadius: 14,
                padding: "10px 4px",
                // clamp() instead of a fixed size: the grid's own container
                // is capped at max-w-xl regardless of viewport, so a phone
                // and an iPad give each option roughly the same available
                // cell width today only on phones -- an iPad has much more
                // room per cell, and a size tuned to fit 4 options on a
                // ~375px phone screen reads as small and unclear once that
                // extra width isn't used. Bumped again after the 1.05rem
                // floor still read as too small on iPhone: at a 375px
                // viewport, 4vw computes to well under that floor, so
                // phones were stuck at the floor value regardless of the
                // vw term — the floor itself needed to go up, not just the
                // scaling factor.
                fontSize: "clamp(1.2rem, 4.5vw, 1.75rem)",
                lineHeight: 1.3,
                minWidth: 0,
                wordBreak: "keep-all",
              }}
            >
              {opt.hanzi}
            </button>
          );
        })}
      </div>

      {fullPhrase && revealed && (
        <button type="button" onClick={() => onDone(passed)} className="btn btn-primary">
          Next →
        </button>
      )}
    </div>
  );
}
