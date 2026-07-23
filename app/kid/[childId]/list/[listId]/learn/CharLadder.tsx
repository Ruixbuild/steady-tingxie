"use client";

import { useEffect, useRef, useState } from "react";
import HanziWriter from "hanzi-writer";
import { charDataLoader } from "@/lib/hanziCache";
import { speak, WORD_RATE } from "@/lib/tts";
import { isPunctuationChar } from "@/lib/hanzi";
import RiceGrid from "@/components/RiceGrid";
import FreehandPad from "@/components/FreehandPad";

type Stage = "watch" | "trace" | "copy";

type Props = {
  char: string;
  /** The full word/phrase this char belongs to, always passed regardless
   * of position — used by the "Say it again" button, which always speaks
   * the whole word/phrase rather than the individual character. */
  word?: string;
  /** Only passed for an item's first character — gates the automatic
   * one-time phrase announcement (see the announce-once-per-item effect
   * below) so it plays once per item, not once per character. */
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

export default function CharLadder({ char, word, announceWord, skipWatch, epochRef, onDone }: Props) {
  const isPunctuation = isPunctuationChar(char);

  function announceAgain() {
    speak(word ?? char, "zh-CN", WORD_RATE);
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
    // Resetting local ladder state when the char prop changes (parent
    // advances the queue) is the intended synchronization here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStage(skipWatch ? "trace" : "watch");
    setLoadError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char]);

  useEffect(() => {
    // Every new stage/attempt starts from that stage's default message,
    // not yet satisfied — matches the prototype's renderLearn() reset.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessage(DEFAULT_MESSAGE[stage]);
    setStageComplete(false);

    // Announce the phrase exactly once when a new character is first
    // shown, regardless of which stage it starts on — a child with "skip
    // watch" on lands straight on trace/copy, never passing through
    // watch, so this is hoisted above the stage branches rather than
    // living inside the watch-stage one. Never repeated on later stage
    // transitions for the same character; only announceWord (passed for
    // an item's first character only) triggers this at all — subsequent
    // characters are silent until the child taps "Say it again".
    if (announcedCharRef.current !== char) {
      announcedCharRef.current = char;
      if (announceWord) speak(announceWord, "zh-CN", WORD_RATE);
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
      epochRef.current += 1; // bump epoch BEFORE teardown — see plan notes
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
    // Punctuation has no real strokes to grade — one write is enough to
    // move on, rather than repeating the same freehand write three times
    // through watch/trace/write.
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
        className="text-sm text-center"
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
          Next →
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
                    className="text-xs"
                    style={{
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
