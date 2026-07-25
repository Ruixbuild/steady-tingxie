"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  childId: string;
  cheer: string | null;
  activeList: { id: string; name: string; testDate: string | null } | null;
  daysToTest: number | null;
  pinnedIds: string[];
  queueIds: string[];
  /** How many words the day's practice defaults to when nothing is
   * parent-pinned — 3 for P1-P3, 5 for P4-P6 (see grade calc in
   * app/kid/[childId]/page.tsx). queueIds is already priority-sorted
   * (struggling items first), so slicing it gives the weakest words. */
  defaultWordCount: number;
};

export default function ChildHomeHero({
  childId,
  cheer,
  activeList,
  daysToTest,
  pinnedIds,
  queueIds,
  defaultWordCount,
}: Props) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);

  function startLearn(ids: string[]) {
    if (!activeList || ids.length === 0) return;
    router.push(`/kid/${childId}/list/${activeList.id}/learn?items=${ids.join(",")}`);
  }

  // Computed once and used for both the label and the actual launch, so
  // they can never disagree — slice() on the real pool already caps at
  // whatever's actually available, so "N words today" can't overstate a
  // short list, and the CTA can't launch a different count than it
  // announced. Previously the label used its own Math.min/defaultWordCount
  // formula while the launch re-sliced separately, so a list with fewer
  // words than defaultWordCount (e.g. a P4 list with 2 words, default 5)
  // showed "5 words today" but only ever launched 2.
  const wordsToday =
    pinnedIds.length > 0 ? pinnedIds.slice(0, defaultWordCount) : queueIds.slice(0, defaultWordCount);

  async function handleCta() {
    if (!activeList || wordsToday.length === 0) return;
    if (pinnedIds.length > 0 && cheer) {
      setToast(`💌 ${cheer}`);
      setTimeout(() => setToast(null), 1900);
      const supabase = createClient();
      await supabase.from("children").update({ cheer: null }).eq("id", childId);
    }
    startLearn(wordsToday);
  }

  const ctaLabel = `▶ ${wordsToday.length} word${wordsToday.length === 1 ? "" : "s"} today`;

  return (
    <div className="flex flex-col gap-4">
      {toast && (
        <div
          className="toast"
          style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 70 }}
        >
          {toast}
        </div>
      )}

      <div
        className="rounded-2xl px-5 py-4 text-white flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: "linear-gradient(135deg,#2C82C9,#5AA7DC)",
          boxShadow: "0 8px 24px rgba(44,130,201,.18)",
        }}
      >
        {activeList ? (
          <>
            <p className="text-sm opacity-90">
              {activeList.name}
              {daysToTest !== null ? ` · ${daysToTest}d to test` : ""}
              {wordsToday.length === 0 && " · 🎉 All caught up for today!"}
            </p>
            {wordsToday.length > 0 && (
              <button type="button" onClick={handleCta} className="btn btn-primary btn-sm shrink-0">
                {ctaLabel}
              </button>
            )}
          </>
        ) : (
          <p className="text-sm opacity-90">Create a list to start practising.</p>
        )}
      </div>
    </div>
  );
}
