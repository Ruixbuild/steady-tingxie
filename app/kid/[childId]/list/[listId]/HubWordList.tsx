"use client";

import { useEffect, useState } from "react";
import PeekModal from "./reader/PeekModal";

const STAGE_EMOJI = ["🌱", "🌿", "🌸", "🌳"] as const;
const PER_CHAR_MS = 2600;

export type HubSection = {
  kind: "words" | "pinyin";
  items: { id: string; hanzi: string; level: number }[];
};

export default function HubWordList({ sections }: { sections: HubSection[] }) {
  const [peekQueue, setPeekQueue] = useState<string[] | null>(null);
  const [peekIndex, setPeekIndex] = useState(0);

  useEffect(() => {
    if (!peekQueue) return;
    const timer = setTimeout(() => {
      if (peekIndex + 1 < peekQueue.length) {
        setPeekIndex((i) => i + 1);
      } else {
        setPeekQueue(null);
        setPeekIndex(0);
      }
    }, PER_CHAR_MS);
    return () => clearTimeout(timer);
  }, [peekQueue, peekIndex]);

  return (
    <div className="flex flex-col gap-4 mb-6">
      {peekQueue && (
        <PeekModal
          char={peekQueue[peekIndex]}
          onClose={() => {
            setPeekQueue(null);
            setPeekIndex(0);
          }}
        />
      )}
      {sections.map((s, i) => (
        <div key={i}>
          <p className="text-sm mb-2" style={{ color: "var(--mut)" }}>
            {s.kind === "words" ? "✍ 写字 / 词语" : "🔤 拼音"}
          </p>
          <div className="flex flex-wrap gap-2">
            {s.items.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  setPeekQueue(Array.from(it.hanzi));
                  setPeekIndex(0);
                }}
                className="hanzi flex items-center gap-1 rounded-2xl px-3 py-2 text-lg"
                style={{ background: "#fff", border: "1.5px solid var(--line)" }}
              >
                {it.hanzi}
                <span className="text-sm">{STAGE_EMOJI[it.level] ?? "🌱"}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
