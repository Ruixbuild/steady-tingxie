"use client";

import { useEffect, useRef, useState } from "react";
import HanziWriter from "hanzi-writer";
import { charDataLoader, getCharData } from "@/lib/hanziCache";
import { speak, speakSequence } from "@/lib/tts";
import RiceGrid from "@/components/RiceGrid";

type Props = {
  char: string;
  announceWord?: string;
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
export default function TestCharQuiz({ char, announceWord, hardMode, epochRef, onDone }: Props) {
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
    if (announceWord) speakSequence([announceWord, char]);
    else speak(char);
  }, [char, announceWord]);

  useEffect(() => {
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
  }, [char, retryKey]);

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
        {done ? "Done ✔ — next one…" : "Write it from memory"}
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => (announceWord ? speakSequence([announceWord, char]) : speak(char))}
          className="btn btn-secondary"
        >
          🔊 Hear it again
        </button>
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
        <RiceGrid />
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      </div>
      <div style={{ minHeight: 56 }} aria-hidden />
    </div>
  );
}
