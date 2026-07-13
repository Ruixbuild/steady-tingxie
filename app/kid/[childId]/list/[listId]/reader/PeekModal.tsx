"use client";

import { useEffect, useRef } from "react";
import HanziWriter from "hanzi-writer";
import { charDataLoader } from "@/lib/hanziCache";
import { speak } from "@/lib/tts";

export default function PeekModal({ char, onClose }: { char: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);

  useEffect(() => {
    speak(char);
  }, [char]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";

    const writer = HanziWriter.create(el, char, {
      width: 240,
      height: 240,
      padding: 20,
      showOutline: false,
      charDataLoader,
      strokeColor: "#1D2A33",
      highlightColor: "#2C82C9",
    });
    writer.loopCharacterAnimation();
    writerRef.current = writer;

    return () => {
      writer.pauseAnimation();
      writerRef.current = null;
    };
  }, [char]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgba(29,42,51,.4)", zIndex: 90 }}
    >
      <div className="card p-6 flex flex-col gap-4 items-center">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => speak(char)}
            className="btn btn-secondary"
            style={{ minHeight: 40, padding: "0 16px" }}
          >
            🔊 Replay
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ minHeight: 40, padding: "0 16px" }}
          >
            Close
          </button>
        </div>

        <div
          ref={containerRef}
          style={{
            width: 240,
            height: 240,
            background: "#fff",
            borderRadius: 26,
            border: "1.5px solid #D5E6F0",
          }}
        />
      </div>
    </div>
  );
}
