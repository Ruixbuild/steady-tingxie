"use client";

import { useEffect, useRef } from "react";
import HanziWriter from "hanzi-writer";
import { charDataLoader } from "@/lib/hanziCache";
import { speak } from "@/lib/tts";
import RiceGrid from "@/components/RiceGrid";

export default function PeekModal({
  char,
  onClose,
  onLoopComplete,
}: {
  char: string;
  onClose: () => void;
  /** Fired once the very first full stroke demo finishes — used by callers
   * that step through multiple characters in sequence, so they advance on
   * real completion rather than a fixed timer. */
  onLoopComplete?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);

  useEffect(() => {
    speak(char);
  }, [char]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";
    let cancelled = false;
    let loopTimeout: ReturnType<typeof setTimeout> | null = null;

    const writer = HanziWriter.create(el, char, {
      width: 220,
      height: 220,
      padding: 20,
      showOutline: false,
      strokeAnimationSpeed: 0.9,
      delayBetweenStrokes: 240,
      charDataLoader,
      strokeColor: "#1D2A33",
      highlightColor: "#2C82C9",
    });
    writerRef.current = writer;

    const loop = (first: boolean) => {
      if (cancelled) return;
      writer.animateCharacter({
        onComplete: () => {
          if (cancelled) return;
          if (first && onLoopComplete) {
            onLoopComplete();
            return; // caller will unmount/advance us
          }
          loopTimeout = setTimeout(() => {
            if (cancelled) return;
            writer.hideCharacter();
            loop(false);
          }, 1200);
        },
      });
    };
    loop(true);

    return () => {
      cancelled = true;
      if (loopTimeout) clearTimeout(loopTimeout);
      writer.pauseAnimation();
      writerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgba(29,42,51,.4)", zIndex: 90 }}
    >
      <div className="card p-6 flex flex-col gap-4 items-center">
        <div className="flex gap-3">
          <button type="button" onClick={() => speak(char)} className="btn btn-sm btn-secondary">
            🔊 Replay
          </button>
          <button type="button" onClick={onClose} className="btn btn-sm btn-secondary">
            Close
          </button>
        </div>

        <div
          style={{
            position: "relative",
            width: 220,
            height: 220,
            background: "#fff",
            borderRadius: 26,
            border: "1.5px solid #D5E6F0",
            overflow: "hidden",
          }}
        >
          <RiceGrid />
          <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
        </div>
        <div style={{ minHeight: 56 }} aria-hidden />
      </div>
    </div>
  );
}
