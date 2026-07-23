"use client";

import { useEffect, useRef, useState } from "react";
import HanziWriter from "hanzi-writer";
import { charDataLoader, getCharData } from "@/lib/hanziCache";
import { speak, CHAR_RATE, WORD_RATE } from "@/lib/tts";
import { isPunctuationChar } from "@/lib/hanzi";
import RiceGrid from "@/components/RiceGrid";
import FreehandPad from "@/components/FreehandPad";

type Props = {
  char: string;
  /** The full word this char belongs to — when provided, the whole word is
   * announced once on mount. TestSession only passes this for an item's
   * first character, so the word is heard once per item; later characters
   * are silent on mount (the child can still tap "Hear it again"). Always
   * omitted when silent (PassageSession's blind quiz never narrates
   * automatically, so there's nothing to announce). */
  announceWord?: string;
  /** The full word this char belongs to, for the "Hear it again" button —
   * unlike announceWord, this is passed for every character in the word,
   * not just the first, so replaying always speaks the whole word
   * regardless of which character is active. Omitted by PassageSession,
   * where revealing the whole passage on a per-character replay tap would
   * defeat the blind-dictation design — there, replay falls back to just
   * the bare character. */
  word?: string;
  /** Skip the automatic on-mount pronunciation — the child can still tap
   * "Hear it again" manually. Used by PassageSession's "first 2 words"
   * reveal mode, where later characters shouldn't get an automatic hint. */
  silent?: boolean;
  /** Hides the "Hear it again" replay button — used by PassageSession's
   * "first 2 words" mode, which supplies its own replay control instead. */
  hideReplayButton?: boolean;
  hardMode: boolean;
  epochRef: { current: number };
  onDone: (result: { strokes: number; totalMistakes: number }) => void;
};

// Blind test-mode quiz for one char: no outline, no per-attempt verdict text.
// Reports the raw stroke count and mistake count only — the pass/fail
// threshold is applied server-side in record_test_attempt, not trusted from
// the client. Epoch-guarded the same way as Learn's CharLadder even though
// there's only one stage here — the hazard (a stale onComplete firing after
// Skip or the 10-min-cap exit) is the same regardless of stage count.
export default function TestCharQuiz({ char, announceWord, word, silent, hideReplayButton, hardMode, epochRef, onDone }: Props) {
  const isPunctuation = isPunctuationChar(char);
  const [done, setDone] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const strokesRef = useRef<number | null>(null);

  useEffect(() => {
    // Resetting local quiz state when the char prop changes (parent
    // advances the queue) is the intended synchronization here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDone(false);
    setLoadError(false);
    if (silent) return;
    if (announceWord) speak(announceWord, "zh-CN", WORD_RATE);
  }, [char, announceWord, silent]);

  useEffect(() => {
    if (isPunctuation) {
      strokesRef.current = 1;
      return;
    }

    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";

    const myEpoch = epochRef.current;

    getCharData(char)
      .then((data) => {
        if (epochRef.current !== myEpoch) return;
        strokesRef.current = data.strokes.length;
      })
      .catch(() => {
        if (epochRef.current !== myEpoch) return;
        setLoadError(true);
      });

    const writer = HanziWriter.create(el, char, {
      width: 260,
      height: 260,
      padding: 20,
      showOutline: false,
      showCharacter: false,
      charDataLoader,
      onLoadCharDataError: () => {
        if (epochRef.current !== myEpoch) return;
        setLoadError(true);
      },
      strokeColor: "#1D2A33",
      drawingColor: "#1D2A33",
      highlightColor: "#2C82C9",
    });

    writer.quiz({
      leniency: hardMode ? 1.5 : 1.9,
      acceptBackwardsStrokes: true,
      markStrokeCorrectAfterMisses: 3,
      showHintAfterMisses: 99,
      onComplete: ({ totalMistakes }) => {
        if (epochRef.current !== myEpoch) return;
        const strokes = strokesRef.current ?? 10;
        setDone(true);
        // Let the finished character sit on screen for a moment before the
        // parent advances the queue and unmounts this canvas.
        setTimeout(() => {
          if (epochRef.current !== myEpoch) return;
          onDone({ strokes, totalMistakes });
        }, 700);
      },
    });

    return () => {
      epochRef.current += 1; // bump epoch BEFORE teardown
      writer.cancelQuiz();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char, retryKey, isPunctuation]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p style={{ color: "var(--mut)" }}>Couldn&apos;t load this character. Try again?</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setLoadError(false);
            setRetryKey((k) => k + 1);
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: "var(--mut)" }}>
        {done ? "Done ✔ — next one…" : isPunctuation ? "Write it, then tap Done" : "Write it from memory"}
      </p>

      <div className="flex gap-3">
        {!hideReplayButton && (
          <button
            type="button"
            onClick={() => (word ? speak(word, "zh-CN", WORD_RATE) : speak(char, "zh-CN", CHAR_RATE))}
            className="btn btn-secondary"
          >
            🔊 Hear it again
          </button>
        )}
        {isPunctuation && !done && (
          <button
            type="button"
            onClick={() => {
              setDone(true);
              setTimeout(() => onDone({ strokes: 1, totalMistakes: 0 }), 500);
            }}
            className="btn btn-primary"
          >
            ✓ Done
          </button>
        )}
        <button
          type="button"
          onClick={() => onDone({ strokes: strokesRef.current ?? 10, totalMistakes: 999 })}
          className="btn btn-secondary"
        >
          ✋ Skip this one
        </button>
      </div>

      <div
        className="mx-auto"
        style={{
          position: "relative",
          width: 260,
          height: 260,
          background: "#fff",
          borderRadius: 26,
          border: "1.5px solid #D5E6F0",
          boxShadow: "0 4px 16px rgba(44,130,201,.08)",
          overflow: "hidden",
          touchAction: "none",
        }}
      >
        {isPunctuation ? (
          <FreehandPad size={260} />
        ) : (
          <>
            <RiceGrid />
            <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
          </>
        )}
      </div>
      <div style={{ minHeight: 56 }} aria-hidden />
    </div>
  );
}
