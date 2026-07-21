"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isTricky } from "@/lib/testScoring";
import Confetti from "@/components/Confetti";

type GardenItem = { id: string; hanzi: string; level: number; misses: number };
type GardenSection = { kind: "words" | "pinyin" | "passage"; title: string | null; items: GardenItem[] };

const KIND_LABEL: Record<GardenSection["kind"], string> = {
  words: "写字 / 词语",
  pinyin: "拼音",
  passage: "默写",
};

const STAGE_EMOJI = ["🌱", "🌿", "🌸"] as const;
const LEVEL_LABEL = ["New", "Learning", "Almost", "Mastered"] as const;

export default function GardenClient({
  childId,
  listId,
  bloomed,
  hardMode,
  sections,
}: {
  childId: string;
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

  const trickyIds = sections
    .flatMap((s) => s.items.map((it) => ({ ...it, kind: s.kind })))
    .filter((it) => isTricky(it.kind, it.level, it.misses))
    .map((it) => it.id);

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

      <div className="card p-5">
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
            {KIND_LABEL[section.kind]}
          </p>
          <div className="flex flex-wrap gap-3">
            {section.items.map((item) => {
              const tricky = isTricky(section.kind, item.level, item.misses);
              const emoji =
                item.level === 3 ? (hardMode ? "🌲" : "🌳") : STAGE_EMOJI[item.level] ?? "🌱";
              return (
                <div
                  key={item.id}
                  className="inline-flex items-center gap-2 rounded-2xl px-3 py-2"
                  style={{
                    background: "var(--card)",
                    border: tricky ? "2px solid var(--warn)" : "1.5px solid var(--line)",
                  }}
                >
                  <span className="text-xl">{emoji}</span>
                  <span className="hanzi text-lg">{item.hanzi}</span>
                  <span className="text-xs" style={{ color: "var(--mut)" }}>
                    {LEVEL_LABEL[item.level] ?? "New"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {trickyIds.length > 0 && (
        <div className="flex flex-wrap gap-3 justify-center mt-2">
          <Link
            href={`/kid/${childId}/list/${listId}/learn?items=${trickyIds.join(",")}`}
            className="btn btn-primary"
          >
            📖 Practise my tricky words
          </Link>
          <Link
            href={`/kid/${childId}/list/${listId}/test?mode=tricky`}
            className="btn btn-secondary"
          >
            ✏️ Test my tricky words
          </Link>
        </div>
      )}
    </div>
  );
}
