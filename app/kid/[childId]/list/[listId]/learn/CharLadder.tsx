"use client";

import { useEffect, useRef, useState } from "react";
import HanziWriter from "hanzi-writer";
import { charDataLoader } from "@/lib/hanziCache";

type Stage = "watch" | "trace" | "copy";

type Props = {
  char: string;
  skipWatch: boolean;
  epochRef: { current: number };
  onDone: (result: { written: boolean; traceSvg: string | null }) => void;
};

const MISTAKE_COPY = "Almost! Follow the glowing stroke ✨";
const STAGE_LABEL: Record<Stage, string> = {
  watch: "👀 Watch",
  trace: "✍ Trace",
  copy: "✏ Copy",
};

export default function CharLadder({ char, skipWatch, epochRef, onDone }: Props) {
  const [stage, setStage] = useState<Stage>(skipWatch ? "trace" : "watch");
  const [mistakeMessage, setMistakeMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Resetting local ladder state when the char prop changes (parent
    // advances the queue) is the intended synchronization here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStage(skipWatch ? "trace" : "watch");
    setMistakeMessage(null);
    setLoadError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";

    const myEpoch = epochRef.current;
    const writer = HanziWriter.create(el, char, {
      width: 280,
      height: 280,
      padding: 20,
      showOutline: stage !== "watch",
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
      writer.loopCharacterAnimation();
    } else if (stage === "trace") {
      writer.quiz({
        leniency: 1.25,
        showHintAfterMisses: 1,
        onMistake: () => {
          if (epochRef.current !== myEpoch) return;
          setMistakeMessage(MISTAKE_COPY);
        },
        onComplete: () => {
          if (epochRef.current !== myEpoch) return;
          setMistakeMessage(null);
          setStage("copy");
        },
      });
    } else {
      writer.quiz({
        leniency: 1.35,
        showHintAfterMisses: 2,
        onMistake: () => {
          if (epochRef.current !== myEpoch) return;
          setMistakeMessage(MISTAKE_COPY);
        },
        onComplete: () => {
          if (epochRef.current !== myEpoch) return;
          const svgEl = el.querySelector("svg");
          const markup = svgEl ? svgEl.outerHTML : null;
          const traceSvg = markup && markup.length <= 8192 ? markup : null;
          onDone({ written: true, traceSvg });
        },
      });
    }

    return () => {
      epochRef.current += 1; // bump epoch BEFORE teardown — see plan notes
      if (stage === "watch") writer.pauseAnimation();
      else writer.cancelQuiz();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char, stage, retryKey]);

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
      <div className="flex items-center justify-between">
        <span className="hanzi text-3xl">{char}</span>
        <span className="text-sm" style={{ color: "var(--mut)" }}>
          {STAGE_LABEL[stage]}
        </span>
      </div>

      {mistakeMessage && (
        <p className="text-sm" style={{ color: "var(--accent)" }}>
          {mistakeMessage}
        </p>
      )}

      <div className="flex gap-3">
        {stage === "watch" && (
          <>
            <button type="button" onClick={() => setStage("trace")} className="btn btn-primary">
              Next
            </button>
            <button
              type="button"
              onClick={() => onDone({ written: false, traceSvg: null })}
              className="btn btn-secondary"
            >
              I know this one ⤼
            </button>
          </>
        )}
      </div>

      <div
        ref={containerRef}
        className="mx-auto"
        style={{
          width: 280,
          height: 280,
          background: "#fff",
          borderRadius: 26,
          border: "1.5px solid #D5E6F0",
          boxShadow: "0 4px 16px rgba(44,130,201,.08)",
          touchAction: "none",
        }}
      />
      <div style={{ minHeight: 56 }} aria-hidden />
    </div>
  );
}
