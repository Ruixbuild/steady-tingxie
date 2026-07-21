"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Confetti from "@/components/Confetti";
import { speak } from "@/lib/tts";
import { strokeChars } from "@/lib/hanzi";
import CharLadder from "./CharLadder";
import PinyinDrill from "./PinyinDrill";

export type LearnItem = {
  id: string;
  hanzi: string;
  pinyin: string | null;
  kind: "words" | "pinyin" | "passage";
};

export default function LearnSession({
  childId,
  listId,
  items,
  initialXp,
}: {
  childId: string;
  listId: string;
  items: LearnItem[];
  initialXp: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const epochRef = useRef(0);
  const xpRef = useRef(initialXp);

  const [skipWatch, setSkipWatch] = useState(false);
  const [queueIndex, setQueueIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [writtenSoFar, setWrittenSoFar] = useState(0);
  const [lastTraceSvg, setLastTraceSvg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // localStorage is only available client-side; this is the standard
    // hydration-safe pattern for reading it once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSkipWatch(localStorage.getItem(`skipWatch:${childId}`) === "true");
  }, [childId]);

  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? null : t)), 1900);
  }

  async function recordItemProgress(itemId: string, chars: number, svg: string | null) {
    const { data: newXp } = await supabase.rpc("record_item_progress", {
      child_id: childId,
      item_id: itemId,
      chars_written: chars,
      trace_svg: svg,
    });
    if (typeof newXp === "number") {
      const before = Math.floor(xpRef.current / 50);
      const after = Math.floor(newXp / 50);
      xpRef.current = newXp;
      if (after > before) {
        showToast(`⭐ Level up! You're a Writer Lv ${after + 1}!`);
      }
    }
  }

  const currentItem = items[queueIndex];

  function advanceToNextItem() {
    setCharIndex(0);
    setWrittenSoFar(0);
    setLastTraceSvg(null);
    if (queueIndex + 1 >= items.length) {
      finishSet();
    } else {
      setQueueIndex((i) => i + 1);
    }
  }

  async function handleCharDone(result: { written: boolean; traceSvg: string | null }) {
    const chars = strokeChars(currentItem.hanzi);
    const nextWritten = writtenSoFar + (result.written ? 1 : 0);
    const nextSvg = result.traceSvg ?? lastTraceSvg;

    if (charIndex + 1 < chars.length) {
      setWrittenSoFar(nextWritten);
      setLastTraceSvg(nextSvg);
      setCharIndex((i) => i + 1);
      return;
    }

    await recordItemProgress(currentItem.id, nextWritten, nextSvg);
    showToast(`${currentItem.hanzi} 🌸 leveled up!`);
    advanceToNextItem();
  }

  async function handlePinyinDone() {
    await recordItemProgress(currentItem.id, 0, null);
    showToast(`${currentItem.hanzi} 🌸 leveled up!`);
    advanceToNextItem();
  }

  function handleSkipItem() {
    advanceToNextItem();
  }

  async function finishSet() {
    // xp gained this session / 2 == chars written this session, since
    // record_item_progress credits +2 xp per char written.
    const charsWrittenThisSession = Math.max(0, xpRef.current - initialXp) / 2;
    await supabase.rpc("record_set_complete", {
      child_id: childId,
      list_id: listId,
      items_count: items.length,
      chars_written: charsWrittenThisSession,
    });
    setComplete(true);
    setShowConfetti(true);
    speak("太棒了");
  }

  if (items.length === 0) {
    return (
      <div className="card p-8 text-center" style={{ color: "var(--mut)" }}>
        Nothing to practise here yet.
      </div>
    );
  }

  if (complete) {
    return (
      <div className="flex flex-col items-center gap-6 py-12">
        {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
        <h2 className="text-2xl font-semibold">🎉 太棒了!</h2>
        <p style={{ color: "var(--mut)" }}>{items.length} items practised</p>
        <button type="button" className="btn btn-primary" onClick={() => router.push(`/kid/${childId}/list/${listId}`)}>
          Back to hub
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {toast && (
        <div className="toast" style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 70 }}>
          {toast}
        </div>
      )}

      <div className="text-center">
        <p className="text-sm" style={{ color: "var(--mut)" }}>
          Item {queueIndex + 1} of {items.length} · today&apos;s set
        </p>
        <h1 className="hanzi text-3xl mt-1">{currentItem.hanzi}</h1>
      </div>

      <button
        type="button"
        onClick={handleSkipItem}
        className="btn btn-sm btn-secondary self-center"
      >
        ✓ I know this
      </button>

      {currentItem.kind !== "pinyin" && (
        <div className="flex gap-2 justify-center flex-wrap">
          {strokeChars(currentItem.hanzi).map((c, i) => {
            const done = i < charIndex;
            const on = i === charIndex;
            const clickable = currentItem.kind === "passage" && i !== charIndex;
            return (
              <span
                key={i}
                onClick={clickable ? () => setCharIndex(i) : undefined}
                className="hanzi flex items-center justify-center"
                style={{
                  minWidth: 44,
                  height: 44,
                  fontSize: "1.3rem",
                  borderRadius: 12,
                  border: `1.5px solid ${on ? "var(--accent)" : done ? "var(--ok)" : "var(--line)"}`,
                  background: on ? "var(--accent-soft)" : done ? "var(--ok-soft)" : "#fff",
                  color: on ? "var(--accent-d)" : "var(--ink)",
                  cursor: clickable ? "pointer" : undefined,
                }}
              >
                {c}
              </span>
            );
          })}
        </div>
      )}

      {currentItem.kind !== "pinyin" ? (
        <CharLadder
          key={`${currentItem.id}-${charIndex}`}
          char={strokeChars(currentItem.hanzi)[charIndex]}
          announceWord={charIndex === 0 && strokeChars(currentItem.hanzi).length > 1 ? currentItem.hanzi : undefined}
          skipWatch={skipWatch}
          epochRef={epochRef}
          onDone={handleCharDone}
        />
      ) : (
        <PinyinDrill
          key={currentItem.id}
          hanzi={currentItem.hanzi}
          answer={currentItem.pinyin ?? ""}
          onDone={handlePinyinDone}
        />
      )}
    </div>
  );
}
