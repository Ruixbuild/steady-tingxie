"use client";

// Revision's own stroke-practice ladder — a fork of TingXie's CharLadder
// (app/kid/[childId]/list/[listId]/learn/CharLadder.tsx), kept as a
// separate file per CLAUDE.md's Revision guardrails rather than editing
// that component in place. The stroke-writer mechanics (HanziWriter setup,
// epoch-guard pattern, watch/trace/write stage ladder, punctuation
// handling) are unchanged — the only real difference is narration: this
// version speaks through lib/revision/narration's speakRevision (native
// rate, no artificial pausing) instead of lib/narration.ts's PACING/
// AUTO_ANNOUNCE tables, which slow speech down and insert inter-clause
// pauses for TingXie's dictation tests. That policy has no ItemKind/Surface
// concept to plug into here, hence the fork rather than a shared prop.

import { useEffect, useRef, useState } from "react";
import HanziWriter from "hanzi-writer";
import { charDataLoader } from "@/lib/hanziCache";
import { speakRevision } from "@/lib/revision/narration";
import { isPunctuationChar } from "@/lib/hanzi";
import RiceGrid from "@/components/RiceGrid";
import FreehandPad from "@/components/FreehandPad";

type Stage = "watch" | "trace" | "copy";

type Props = {
  char: string;
  /** The full word/phrase this char belongs to — used by "Say it again",
   * which always speaks the whole word rather than the individual
   * character. */
  word?: string;
  /** Only passed for a word's first character — gates the automatic
   * one-time announcement so it plays once per word, not once per
   * character. */
  announceWord?: string;
  skipWatch: boolean;
  epochRef: { current: number };
  onDone: (result: { written: boolean; traceSvg: string | null }) => void;
};

const STAGE_ORDER: Stage[] = ["watch", "trace", "copy"];
const STAGE_LABEL: Record<Stage, string> = {
  watch: "👀 Watch",
  trace: "✍ Trace",
  copy: "✏ Write",
};
const DEFAULT_MESSAGE: Record<Stage, string> = {
  watch: "👀 Watch how it's written…",
  trace: "✍ Trace the grey strokes in order.",
  copy: "✏ Now from memory — you can do it!",
};

export default function StrokeLadder({
  char,
  word,
  announceWord,
  skipWatch,
  epochRef,
  onDone,
}: Props) {
  const isPunctuation = isPunctuationChar(char);

  function announceAgain() {
    speakRevision(word ?? char);
  }
  const [stage, setStage] = useState<Stage>(skipWatch ? "trace" : "watch");
  const [message, setMessage] = useState(DEFAULT_MESSAGE[skipWatch ? "trace" : "watch"]);
  const [stageComplete, setStageComplete] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingSvgRef = useRef<string | null>(null);
  const loopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announcedCharRef = useRef<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStage(skipWatch ? "trace" : "watch");
    setLoadError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessage(DEFAULT_MESSAGE[stage]);
    setStageComplete(false);

    if (announcedCharRef.current !== char) {
      announcedCharRef.current = char;
      if (announceWord) speakRevision(announceWord);
    }

    if (isPunctuation) {
      setMessage("✏ Give it a try — no strokes are graded for punctuation.");
      return;
    }

    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";

    const myEpoch = epochRef.current;
    const writer = HanziWriter.create(el, char, {
      width: 260,
      height: 260,
      padding: 20,
      showOutline: stage === "trace",
      strokeAnimationSpeed: 0.9,
      delayBetweenStrokes: 260,
      charDataLoader,
      onLoadCharDataError: () => {
        if (epochRef.current !== myEpoch) return;
        setLoadError(true);
      },
      strokeColor: "#1D2A33",
      radicalColor: null,
      highlightColor: "#2C82C9",
      outlineColor: "#DDE6EE",
      drawingColor: "#1D2A33",
    });

    if (stage === "watch") {
      const loop = (first: boolean) => {
        if (epochRef.current !== myEpoch) return;
        writer.animateCharacter({
          onComplete: () => {
            if (epochRef.current !== myEpoch) return;
            if (first) {
              setMessage("Keep watching, or go trace it!");
              setStageComplete(true);
            }
            loopTimeoutRef.current = setTimeout(() => {
              if (epochRef.current !== myEpoch) return;
              writer.hideCharacter();
              loop(false);
            }, 1300);
          },
        });
      };
      loop(true);
    } else if (stage === "trace") {
      writer.quiz({
        leniency: 1.25,
        showHintAfterMisses: 1,
        onMistake: () => {
          if (epochRef.current !== myEpoch) return;
          setMessage("Almost! Follow the glowing stroke ✨");
        },
        onCorrectStroke: () => {
          if (epochRef.current !== myEpoch) return;
          setMessage("✍ Nice — keep going!");
        },
        onComplete: () => {
          if (epochRef.current !== myEpoch) return;
          setMessage("✓ Traced! Now copy it without the outline.");
          setStageComplete(true);
        },
      });
    } else {
      writer.quiz({
        leniency: 1.35,
        showHintAfterMisses: 2,
        onMistake: () => {
          if (epochRef.current !== myEpoch) return;
          setMessage("Try that stroke again — a hint comes if you need it 💪");
        },
        onComplete: () => {
          if (epochRef.current !== myEpoch) return;
          const svgEl = el.querySelector("svg");
          const markup = svgEl ? svgEl.outerHTML : null;
          pendingSvgRef.current = markup && markup.length <= 8192 ? markup : null;
          setMessage("✓ 写得好! You wrote it yourself!");
          setStageComplete(true);
        },
      });
    }

    return () => {
      epochRef.current += 1; // bump epoch BEFORE teardown
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      if (stage === "watch") writer.pauseAnimation();
      else writer.cancelQuiz();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char, stage, retryKey, isPunctuation]);

  function handleKnowIt() {
    setStage("copy");
  }

  function handleNext() {
    if (!stageComplete) return;
    if (isPunctuation) {
      onDone({ written: true, traceSvg: null });
      return;
    }
    const idx = STAGE_ORDER.indexOf(stage);
    if (idx < STAGE_ORDER.length - 1) {
      setStage(STAGE_ORDER[idx + 1]);
      return;
    }
    onDone({ written: true, traceSvg: pendingSvgRef.current });
  }

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
      <p
        className="text-base text-center"
        style={{ color: "var(--accent)", fontWeight: 600, minHeight: "1.4em" }}
      >
        {message}
      </p>

      <div className="flex gap-3 flex-wrap justify-center">
        <button type="button" onClick={announceAgain} className="btn btn-sm btn-secondary">
          🔊 Say it again
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!stageComplete}
          className="btn btn-sm btn-primary"
        >
          {stageComplete ? "Next →" : "🔒 Next →"}
        </button>
        {stage === "watch" && !isPunctuation && (
          <button type="button" onClick={handleKnowIt} className="btn btn-sm btn-secondary">
            Skip to Write ⤼
          </button>
        )}
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
          <>
            <div
              className="hanzi flex items-center justify-center"
              style={{ position: "absolute", inset: 0, fontSize: "5rem", color: "var(--line)", opacity: 0.6 }}
              aria-hidden
            >
              {char}
            </div>
            <div style={{ position: "absolute", inset: 0 }}>
              <FreehandPad
                key={`${stage}-${retryKey}`}
                size={260}
                onFirstStroke={() => setStageComplete(true)}
              />
            </div>
          </>
        ) : (
          <>
            <RiceGrid />
            <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
          </>
        )}
      </div>

      {!isPunctuation && (
        <div className="flex items-center justify-center" aria-hidden>
          {STAGE_ORDER.map((s, i) => {
            const stageIdx = STAGE_ORDER.indexOf(stage);
            const done = i < stageIdx;
            const on = s === stage;
            const dotColor = on ? "var(--accent)" : done ? "var(--ok)" : "var(--line)";
            return (
              <div key={s} className="flex items-center">
                <div className="flex flex-col items-center gap-1" style={{ width: 64 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: dotColor,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: on ? 700 : 500,
                      color: on ? "var(--accent)" : done ? "#1D6E47" : "var(--mut)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {STAGE_LABEL[s]}
                  </span>
                </div>
                {i < STAGE_ORDER.length - 1 && (
                  <div
                    style={{
                      width: 24,
                      height: 2,
                      marginBottom: 16,
                      background: done ? "var(--ok)" : "var(--line)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      <div style={{ minHeight: 56 }} aria-hidden />
    </div>
  );
}
