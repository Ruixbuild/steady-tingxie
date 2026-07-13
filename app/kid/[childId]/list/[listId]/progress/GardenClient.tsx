"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isTricky } from "@/lib/testScoring";
import Confetti from "@/components/Confetti";

type GardenItem = { id: string; hanzi: string; level: number; misses: number };
type GardenSection = { kind: "words" | "pinyin"; title: string | null; items: GardenItem[] };

const STAGE_EMOJI = ["🌱", "🌿", "🌸"] as const;

export default function GardenClient({
  listId,
  bloomed,
  hardMode,
  sections,
}: {
  listId: string;
  bloomed: boolean;
  hardMode: boolean;
  sections: GardenSection[];
}) {
  const [showConfetti, setShowConfetti] = useState(false);
  const flippedRef = useRef(false);

  const allItems = sections.flatMap((s) => s.items);
  const total = allItems.length;
  const bloomedCount = allItems.filter((it) => it.level === 3).length;
  const fullBloom = total > 0 && bloomedCount === total;

  useEffect(() => {
    if (fullBloom && !bloomed && !flippedRef.current) {
      flippedRef.current = true;
      setShowConfetti(true);
      const supabase = createClient();
      supabase.from("lists").update({ bloomed: true }).eq("id", listId).then(() => {});
    }
  }, [fullBloom, bloomed, listId]);

  return (
    <div className="flex flex-col gap-6">
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}

      <div>
        <p className="font-semibold mb-2">
          {hardMode ? "🌲" : "🌳"} {bloomedCount}/{total} in full bloom
        </p>
        <div
          className="w-full rounded-full overflow-hidden"
          style={{ height: 8, background: "var(--line)" }}
        >
          <div
            style={{
              width: total > 0 ? `${(100 * bloomedCount) / total}%` : "0%",
              height: "100%",
              background: "var(--ok)",
            }}
          />
        </div>
      </div>

      {sections.map((section, sIdx) => (
        <div key={sIdx}>
          <p className="text-sm mb-2" style={{ color: "var(--mut)" }}>
            {section.kind === "words" ? "词语" : "拼音"}
          </p>
          <div className="flex flex-wrap gap-2">
            {section.items.map((item) => {
              const tricky = isTricky(section.kind, item.level, item.misses);
              const emoji =
                item.level === 3 ? (hardMode ? "🌲" : "🌳") : STAGE_EMOJI[item.level] ?? "🌱";
              return (
                <div
                  key={item.id}
                  className="hanzi flex items-center justify-center text-2xl rounded-2xl"
                  style={{
                    width: 56,
                    height: 56,
                    background: "#fff",
                    border: tricky ? "2px solid var(--warn)" : "1px solid var(--line)",
                  }}
                  title={item.hanzi}
                >
                  {emoji}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
