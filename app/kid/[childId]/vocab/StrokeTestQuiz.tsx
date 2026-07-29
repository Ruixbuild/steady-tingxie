"use client";

// Revision's own blind test-mode stroke quiz — a fork of TingXie's
// TestCharQuiz (app/kid/[childId]/list/[listId]/test/TestCharQuiz.tsx), kept
// separate per CLAUDE.md's Revision guardrails. Same blind-quiz mechanics
// (no outline, no character shown, hints effectively disabled, epoch-guard
// pattern) — narration goes through lib/revision/narration's speakRevision
// instead of lib/narration.ts, which has no ItemKind/Surface concept to plug
// into here. Reports raw {strokes, totalMistakes} up; pass/fail is graded
// server-side in record_revision_word_attempt, not trusted from the client.

import { useEffect, useRef, useState } from "react";
import HanziWriter from "hanzi-writer";
import { charDataLoader, getCharData } from "@/lib/hanziCache";
import { speakRevision } from "@/lib/revision/narration";
import { isPunctuationChar } from "@/lib/hanzi";
import RiceGrid from "@/components/RiceGrid";
import FreehandPad from "@/components/FreehandPad";

type Props = {
  char: string;
  /** The full word this char belongs to — announced once when passed
   * (mirrors TestCharQuiz's announceWord: only the item's first character
   * gets this, so the word is heard once per item). */
  announceWord?: string;
  /** The full word this char belongs to, for the "Say it again" button —
   * passed for every character so replay always speaks the whole word. */
  word?: string;
  epochRef: { current: number };
  onDone: (result: { strokes: number; totalMistakes: number }) => void;
};

export default function StrokeTestQuiz({ char, announceWord, word, epochRef, onDone }: Props) {
  const isPunctuation = isPunctuationChar(char);
  const [done, setDone] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const strokesRef = useRef<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDone(false);
    setLoadError(false);
    if (announceWord) speakRevision(announceWord);
  }, [char, announceWord]);

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
      leniency: 1.9,
      acceptBackwardsStrokes: true,
      markStrokeCorrectAfterMisses: 3,
      showHintAfterMisses: 99,
      onComplete: ({ totalMistakes }) => {
        if (epochRef.current !== myEpoch) return;
        const strokes = strokesRef.current ?? 10;
        setDone(true);
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
        {done ? "Done ✔ — next one…" : isPunctuation ? "Write it, then tap Next" : "Write it from memory"}
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => speakRevision(word ?? char)}
          className="btn btn-secondary"
        >
          🔊 Say it again
        </button>
        {isPunctuation && !done && (
          <button
            type="button"
            onClick={() => {
              setDone(true);
              setTimeout(() => onDone({ strokes: 1, totalMistakes: 0 }), 500);
            }}
            className="btn btn-primary"
          >
            Next →
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
