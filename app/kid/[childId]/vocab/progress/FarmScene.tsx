"use client";

// The vocab hub's cross-chapter view: a pure trophy shelf, not a progress
// dashboard. Two fixed 5-wide grids (识读/land on top, 识写/sea below), one
// slot per chapter in chapter order — a slot only shows a species icon once
// that chapter+skill is fully mastered; otherwise it's a numbered dashed
// placeholder. No progress bar, no growth stages, no per-chapter nav list —
// see lib/revision/farmScene.ts for why (deliberately simpler than
// TingXie's own seasonal /garden scene, which this replaces the design cue
// from but not the mechanics of).

import { useState } from "react";
import { buildFarmSlots, type FarmSlot } from "@/lib/revision/farmScene";
import { masteryMapFromRows, skillProgress } from "@/lib/revision/mastery";
import type { ChapterSummary, RevisionMastery } from "@/lib/revision/types";

const SKILL_LABEL: Record<"read" | "write", string> = { read: "识读", write: "识写" };

function FarmGrid({
  slots,
  skill,
  onSelect,
}: {
  slots: FarmSlot[];
  skill: "read" | "write";
  onSelect: (slot: FarmSlot) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {slots.map((slot) => (
        <button
          key={slot.chapterNumber}
          type="button"
          disabled={!slot.mastered}
          onClick={() => onSelect(slot)}
          className="flex items-center justify-center"
          style={{
            aspectRatio: "1",
            borderRadius: 12,
            fontSize: slot.mastered ? 20 : 11,
            cursor: slot.mastered ? "pointer" : "default",
            background: slot.mastered ? "rgba(255,255,255,0.85)" : "transparent",
            border: slot.mastered ? "none" : `1.5px dashed ${skill === "read" ? "#8FAF7A" : "#DCEFFA"}`,
            color: slot.mastered ? undefined : skill === "read" ? "#8FAF7A" : "#EAF6FF",
            boxShadow: slot.mastered ? "0 1px 3px rgba(0,0,0,0.08)" : undefined,
          }}
          aria-label={slot.mastered ? `${slot.chapterTitle} — ${SKILL_LABEL[skill]}, mastered` : `Chapter ${slot.chapterNumber}, not yet mastered`}
        >
          {slot.mastered ? slot.species : slot.chapterNumber}
        </button>
      ))}
    </div>
  );
}

export default function FarmScene({
  chapters,
  masteryRows,
}: {
  chapters: ChapterSummary[];
  masteryRows: RevisionMastery[];
}) {
  const masteryByKey = masteryMapFromRows(masteryRows);
  const [selected, setSelected] = useState<{ label: string; skill: "read" | "write" } | null>(null);

  const chapterMastery = chapters.map((c) => {
    const read = skillProgress(c.words, "read", masteryByKey);
    const write = skillProgress(c.words, "write", masteryByKey);
    return {
      chapterNumber: c.chapterNumber,
      chapterTitle: c.chapterTitle,
      readMastered: read.total > 0 && read.mastered === read.total,
      writeMastered: write.total > 0 && write.mastered === write.total,
    };
  });

  const readSlots = buildFarmSlots(
    chapterMastery.map((c) => ({ chapterNumber: c.chapterNumber, chapterTitle: c.chapterTitle, mastered: c.readMastered })),
    "read"
  );
  const writeSlots = buildFarmSlots(
    chapterMastery.map((c) => ({ chapterNumber: c.chapterNumber, chapterTitle: c.chapterTitle, mastered: c.writeMastered })),
    "write"
  );

  function handleSelect(slot: FarmSlot, skill: "read" | "write") {
    setSelected({ label: `Chapter ${slot.chapterNumber} · ${SKILL_LABEL[skill]}`, skill });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[22px] overflow-hidden" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
        <div
          className="p-4"
          style={{ background: "linear-gradient(180deg,#EAF3E0 0%,#DFF0C4 100%)" }}
        >
          <p className="mb-2" style={{ fontSize: 12, fontWeight: 700, color: "#4A6B3A" }}>
            🌿 识读
          </p>
          <FarmGrid slots={readSlots} skill="read" onSelect={(slot) => handleSelect(slot, "read")} />
        </div>
        <div
          className="p-4"
          style={{ background: "linear-gradient(180deg,#9FD8E8 0%,#4C93CE 100%)" }}
        >
          <p className="mb-2" style={{ fontSize: 12, fontWeight: 700, color: "#EAF6FF" }}>
            🌊 识写
          </p>
          <FarmGrid slots={writeSlots} skill="write" onSelect={(slot) => handleSelect(slot, "write")} />
        </div>
      </div>

      {selected && (
        <p className="text-center text-sm font-semibold" style={{ color: "var(--accent-d)" }}>
          {selected.label}
        </p>
      )}
    </div>
  );
}
