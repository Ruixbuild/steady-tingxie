"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  childId: string;
  cheer: string | null;
  activeList: { id: string; name: string; testDate: string | null } | null;
  daysToTest: number | null;
  pinnedIds: string[];
  queueIds: string[];
  surpriseId: string | null;
};

export default function ChildHomeHero({
  childId,
  cheer,
  activeList,
  daysToTest,
  pinnedIds,
  queueIds,
  surpriseId,
}: Props) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [skipWatch, setSkipWatchState] = useState(false);

  useEffect(() => {
    // localStorage is only available client-side; this is the standard
    // hydration-safe pattern for reading it once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSkipWatchState(localStorage.getItem(`skipWatch:${childId}`) === "true");
  }, [childId]);

  function toggleSkipWatch(next: boolean) {
    setSkipWatchState(next);
    localStorage.setItem(`skipWatch:${childId}`, String(next));
  }

  function startLearn(ids: string[]) {
    if (!activeList || ids.length === 0) return;
    router.push(`/kid/${childId}/list/${activeList.id}/learn?items=${ids.join(",")}`);
  }

  async function handleCta() {
    if (!activeList) return;
    if (pinnedIds.length > 0) {
      if (cheer) {
        setToast(`💌 ${cheer}`);
        setTimeout(() => setToast(null), 1900);
        const supabase = createClient();
        await supabase.from("children").update({ cheer: null }).eq("id", childId);
      }
      startLearn(pinnedIds.slice(0, 5));
    } else {
      setShowOverlay(true);
    }
  }

  function handleSurprise() {
    if (surpriseId) startLearn([surpriseId]);
  }

  const ctaLabel =
    pinnedIds.length > 0 ? `▶ ${Math.min(pinnedIds.length, 5)} words today` : "▶ 3 words today";

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
        className="rounded-[26px] p-6 text-white flex flex-col gap-3"
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
              {pinnedIds.length > 0 ? " · ⭐ picked for you" : ""}
            </p>
            <div className="flex gap-3 flex-wrap">
              <button type="button" onClick={handleCta} className="btn btn-primary">
                {ctaLabel}
              </button>
              {surpriseId && (
                <button
                  type="button"
                  onClick={handleSurprise}
                  className="btn"
                  style={{
                    background: "rgba(255,255,255,.2)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,.4)",
                  }}
                >
                  🎲 Surprise word
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm opacity-90">Create a list to start practising.</p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm" style={{ color: "var(--mut)" }}>
        <input
          type="checkbox"
          checked={skipWatch}
          onChange={(e) => toggleSkipWatch(e.target.checked)}
        />
        Skip Watch — go straight to tracing
      </label>

      {showOverlay && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: "rgba(29,42,51,.4)", zIndex: 80 }}
        >
          <div className="card p-6 flex flex-col gap-4 max-w-xs w-full">
            <p className="font-semibold text-center">How many words today?</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setShowOverlay(false);
                startLearn(queueIds.slice(0, 3));
              }}
            >
              🎯 Quick 3
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setShowOverlay(false);
                startLearn(queueIds.slice(0, 5));
              }}
            >
              💪 Big 5
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
