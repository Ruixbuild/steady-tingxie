"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export type FocusData = {
  childId: string;
  childName: string;
  lastSummary: string | null;
  activeList: { id: string; name: string } | null;
  daysToTest: number | null;
  predicted: number;
  sections: { kind: "words" | "pinyin" | "passage"; r: number; light: "green" | "orange" | "red" }[];
  weakTop5: { itemId: string; hanzi: string; kind: "words" | "pinyin" }[];
  weakByKind: { words: string[]; pinyin: string[]; passage: string[] };
  weakPassageChars: string[];
  wordsPerDay?: number | null;
};

const LIGHT_COLOR = { green: "var(--ok)", orange: "var(--warn)", red: "var(--miss)" };
const KIND_LABEL = { words: "词语", pinyin: "拼音", passage: "默写" };

export default function ChildFocusCard({ data }: { data: FocusData }) {
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  async function pinItems(itemIds: string[]) {
    if (itemIds.length === 0) return;
    const supabase = createClient();
    await supabase
      .from("mastery")
      .update({ pinned: true })
      .eq("child_id", data.childId)
      .in("item_id", itemIds);
    setPinnedIds((prev) => new Set([...prev, ...itemIds]));
  }

  if (!data.activeList) {
    return (
      <div className="card p-5">
        <p className="font-semibold">{data.childName}</p>
        <p style={{ color: "var(--mut)" }}>No active list yet.</p>
      </div>
    );
  }

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div>
        <p className="font-semibold">{data.childName}</p>
        <p style={{ color: "var(--mut)" }}>
          On track for ~{data.predicted}% · {data.activeList.name}
          {data.daysToTest !== null ? ` · ${data.daysToTest}d to test` : ""}
        </p>
      </div>

      <div className="flex gap-4">
        {data.sections.map((s) => (
          <span key={s.kind} className="flex items-center gap-1 text-sm">
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: LIGHT_COLOR[s.light],
              }}
            />
            {KIND_LABEL[s.kind]}
          </span>
        ))}
      </div>

      {data.wordsPerDay != null && (
        <p className="text-sm" style={{ color: "var(--mut)" }}>
          Needs ~{data.wordsPerDay} words/day to be ready.
        </p>
      )}

      {data.lastSummary && (
        <p className="text-sm" style={{ color: "var(--mut)" }}>
          Since last session: {data.lastSummary}
        </p>
      )}

      {data.weakPassageChars.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs" style={{ color: "var(--mut)" }}>
            默写 — needs practice
          </p>
          <p className="hanzi" style={{ color: "#B8600B" }}>
            {data.weakPassageChars.join(" ")}
          </p>
        </div>
      )}

      {data.weakTop5.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs" style={{ color: "var(--mut)" }}>
            Pins appear as &quot;today&apos;s set&quot;.
          </p>
          {data.weakTop5.map((item) => {
            const pinned = pinnedIds.has(item.itemId);
            return (
              <div key={item.itemId} className="flex items-center justify-between">
                <span className="hanzi">{item.hanzi}</span>
                <button
                  type="button"
                  disabled={pinned}
                  onClick={() => pinItems([item.itemId])}
                  className="btn btn-sm btn-secondary"
                >
                  {pinned ? "Pinned ✓" : "Send to practice"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {data.weakByKind.words.length > 0 && (
          <button
            type="button"
            onClick={() => pinItems(data.weakByKind.words)}
            className="btn btn-secondary"
          >
            Pin 3 weakest words
          </button>
        )}
        {data.weakByKind.pinyin.length > 0 && (
          <button
            type="button"
            onClick={() => pinItems(data.weakByKind.pinyin)}
            className="btn btn-secondary"
          >
            Pin 3 weakest pinyin
          </button>
        )}
        {data.weakByKind.passage.length > 0 && (
          <button
            type="button"
            onClick={() => pinItems(data.weakByKind.passage)}
            className="btn btn-secondary"
          >
            Send 默写 to practice
          </button>
        )}
        <Link
          href={`/kid/${data.childId}/list/${data.activeList.id}/test?mode=tricky&supervised=true`}
          className="btn btn-secondary"
        >
          Quick drill together
        </Link>
      </div>
    </div>
  );
}
