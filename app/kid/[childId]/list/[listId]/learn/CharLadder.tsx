"use client";

import { useEffect, useRef, useState } from "react";
import HanziWriter from "hanzi-writer";
import { charDataLoader } from "@/lib/hanziCache";
import { speak } from "@/lib/tts";
import RiceGrid from "@/components/RiceGrid";

type Stage = "watch" | "trace" | "copy";

type Props = {
  char: string;
  skipWatch: boolean;
  epochRef: { current: number };
  onDone: (result: { written: boolean; traceSvg: string | null }) => void;
};

const STAGE_ORDER: Stage[] = ["watch", "trace", "copy"];
const STAGE_LABEL: Record<Stage, string> = {
  watch: "👀 Watch",
  trace: "✍ Trace",
  copy: "✏ Copy",
};
const DEFAULT_MESSAGE: Record<Stage, string> = {
  watch: "👀 Watch how it's written…",
  trace: "✍ Trace the grey strokes in order.",
  copy: "✏ Now from memory — you can do it!",
};

export default function CharLadder({ char, skipWatch, epochRef, onDone }: Props) {
  const [stage, setStage] = useState<Stage>(skipWatch ? "trace" : "watch");
  const [message, setMessage] = useState(DEFAULT_MESSAGE[skipWatch ? "trace" : "watch"]);
  const [stageComplete, setStageComplete] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingSvgRef = useRef<string | null>(null);
  const loopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";

    const myEpoch = epochRef.current;
    const writer = HanziWriter.create(el, char, {
      width: 280,
      height: 280,
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
              setMessage("See it? Again, or go trace it!");
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
  }, [char, stage, retryKey]);

  function handleAgain() {
    setRetryKey((k) => k + 1);
  }

  function handleKnowIt() {
    setStage("copy");
  }

  function handleNext() {
    if (!stageComplete) return;
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
        <button type="button" onClick={handleAgain} className="btn btn-sm btn-secondary">
          ↺ Again
        </button>
        <button type="button" onClick={() => speak(char)} className="btn btn-sm btn-secondary">
          🔊 Say it
        </button>
        {stage === "watch" && (
          <button type="button" onClick={handleKnowIt} className="btn btn-sm btn-secondary">
            I know this one ⤼
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          disabled={!stageComplete}
          className="btn btn-sm btn-primary"
        >
          Next →
        </button>
      </div>

      <div className="flex gap-2 justify-center">
        {STAGE_ORDER.map((s, i) => {
          const stageIdx = STAGE_ORDER.indexOf(stage);
          const done = i < stageIdx;
          const on = s === stage;
          return (
            <span
              key={s}
              className="text-sm"
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                fontWeight: 700,
                border: `1.5px solid ${on ? "var(--accent)" : done ? "var(--ok)" : "var(--line)"}`,
                background: on ? "var(--accent)" : done ? "var(--ok-soft)" : "#fff",
                color: on ? "#fff" : done ? "#1D6E47" : "var(--mut)",
              }}
            >
              {STAGE_LABEL[s]}
            </span>
          );
        })}
      </div>

      <div
        className="mx-auto"
        style={{
          position: "relative",
          width: 280,
          height: 280,
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
