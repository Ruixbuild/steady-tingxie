"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { stopNarration } from "@/lib/tts";
import { strokeChars } from "@/lib/hanzi";
import type { AttemptMode } from "@/lib/supabase/types";
import type { CharMistakes, ItemResult } from "@/lib/testTypes";
import TestCharQuiz from "./TestCharQuiz";
import TestPinyinInput from "./TestPinyinInput";
import PassageSession from "./PassageSession";

export type TestItem = {
  id: string;
  hanzi: string;
  pinyin: string | null;
  kind: "words" | "pinyin" | "passage";
};

const CAP_MS = 10 * 60 * 1000;

function now() {
  return Date.now();
}

export default function TestSession({
  childId,
  listId,
  mode,
  supervised,
  hardMode,
  guessPct,
  items,
  passageReveal,
}: {
  childId: string;
  listId: string;
  mode: AttemptMode;
  supervised: boolean;
  hardMode: boolean;
  guessPct: number;
  items: TestItem[];
  passageReveal: "full" | "first2";
}) {
  const router = useRouter();
  const epochRef = useRef(0);
  const resultsRef = useRef<ItemResult[]>([]);
  const sessionStartRef = useRef(now());
  const capThresholdRef = useRef(CAP_MS);
  const wordCharResultsRef = useRef<CharMistakes[]>([]);

  const [queueIndex, setQueueIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [wordItemDone, setWordItemDone] = useState(false);
  const [showCapModal, setShowCapModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [submitErrorDetail, setSubmitErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add("test-mode");
    return () => document.body.classList.remove("test-mode");
  }, []);

  useEffect(() => stopNarration, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - sessionStartRef.current >= capThresholdRef.current) {
        setShowCapModal(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentItem = items[queueIndex];

  async function submitAttempt(itemResults: ItemResult[]) {
    setSubmitting(true);
    setSubmitError(false);
    setSubmitErrorDetail(null);
    const supabase = createClient();
    const durationS = Math.round((Date.now() - sessionStartRef.current) / 1000);
    const rpcArgs = {
      child_id: childId,
      list_id: listId,
      mode,
      supervised,
      guess_pct: guessPct,
      duration_s: durationS,
      item_results: itemResults,
      hard_mode: hardMode,
    };
    let { data: attemptId, error } = await supabase.rpc("record_test_attempt", rpcArgs);
    if (error) {
      // A test can easily run longer than the access token's lifetime,
      // especially with the tab backgrounded (mobile browsers throttle the
      // client's own auto-refresh timer while hidden) — one silent retry
      // after refreshing the session covers that common transient case
      // instead of surfacing an error for it.
      await supabase.auth.refreshSession();
      ({ data: attemptId, error } = await supabase.rpc("record_test_attempt", rpcArgs));
    }
    if (error) {
      // Leaving this silent would re-render the same (already-finished) last
      // item from scratch — indistinguishable from the test endlessly
      // repeating. Surface it instead so the child/parent can retry.
      setSubmitting(false);
      setSubmitError(true);
      setSubmitErrorDetail(
        [error.message, error.details, error.hint, error.code].filter(Boolean).join(" | ")
      );
      return;
    }
    router.push(`/kid/${childId}/list/${listId}/results/${attemptId}`);
  }

  function advance() {
    wordCharResultsRef.current = [];
    setCharIndex(0);
    setWordItemDone(false);
    if (queueIndex + 1 >= items.length) {
      submitAttempt(resultsRef.current);
    } else {
      setQueueIndex((i) => i + 1);
    }
  }

  function handleWordCharDone(result: CharMistakes) {
    const chars = strokeChars(currentItem.hanzi);
    wordCharResultsRef.current.push(result);

    if (charIndex + 1 < chars.length) {
      setCharIndex((i) => i + 1);
      return;
    }

    resultsRef.current.push({
      item_id: currentItem.id,
      kind: "words",
      chars: wordCharResultsRef.current,
    });
    // Pause here instead of auto-advancing — the child confirms with Next.
    setWordItemDone(true);
  }

  function handlePinyinDone(result: { passed: boolean }) {
    resultsRef.current.push({ item_id: currentItem.id, kind: "pinyin", passed: result.passed });
    advance();
  }

  function handlePassageDone(result: ItemResult) {
    resultsRef.current.push(result);
    advance();
  }

  function handleSaveAndStop() {
    setShowCapModal(false);
    submitAttempt(resultsRef.current);
  }

  function handleKeepGoing() {
    capThresholdRef.current += CAP_MS;
    setShowCapModal(false);
  }

  if (items.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-xl">
          <Link
            href={`/kid/${childId}/list/${listId}`}
            className="mb-4 inline-block"
            style={{ color: "var(--accent)", fontWeight: 700 }}
          >
            ✕ End test
          </Link>
          <div className="card p-8 text-center" style={{ color: "var(--mut)" }}>
            Nothing to test here yet.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl flex flex-col gap-6">
        <Link
          href={`/kid/${childId}/list/${listId}`}
          className="inline-block"
          style={{ color: "var(--accent)", fontWeight: 700 }}
        >
          ✕ End test
        </Link>

        <div
          className="rounded-2xl px-5 py-3 font-semibold text-center"
          style={{ background: "var(--warn-soft)", color: "#8A6412" }}
        >
          {supervised
            ? "👨‍👩‍👧 Practised together — doesn't count toward mastery"
            : "✏️ Test time — no hints, just try your best!"}
        </div>

        <p className="text-sm" style={{ color: "var(--mut)" }}>
          Item {queueIndex + 1} / {items.length}
        </p>

      {submitting ? (
        <p style={{ color: "var(--mut)" }}>Saving…</p>
      ) : submitError ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-sm text-center" style={{ color: "var(--miss)" }}>
            Couldn&apos;t save your results. Check your connection and try again.
          </p>
          {submitErrorDetail && (
            <p className="text-xs text-center" style={{ color: "var(--mut)" }}>
              {submitErrorDetail}
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => submitAttempt(resultsRef.current)}
          >
            Retry
          </button>
        </div>
      ) : currentItem.kind === "words" ? (
        <>
          {strokeChars(currentItem.hanzi).length > 1 && (
            <div className="flex gap-2 justify-center flex-wrap">
              {strokeChars(currentItem.hanzi).map((c, i) => {
                const done = wordItemDone || i < charIndex;
                return (
                  <span
                    key={i}
                    className="hanzi flex items-center justify-center"
                    style={{
                      minWidth: 44,
                      height: 44,
                      fontSize: "1.3rem",
                      borderRadius: 12,
                      border: `1.5px solid ${done ? "var(--ok)" : "var(--line)"}`,
                      background: done ? "var(--ok-soft)" : "#fff",
                      color: "var(--ink)",
                    }}
                  >
                    {done ? c : ""}
                  </span>
                );
              })}
            </div>
          )}
          {wordItemDone ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <p className="text-sm" style={{ color: "var(--mut)" }}>
                Done ✔ — {currentItem.hanzi}
              </p>
              <button type="button" className="btn btn-primary" onClick={advance}>
                Next →
              </button>
            </div>
          ) : (
            <TestCharQuiz
              key={`${currentItem.id}-${charIndex}`}
              char={strokeChars(currentItem.hanzi)[charIndex]}
              announceWord={charIndex === 0 ? currentItem.hanzi : undefined}
              hardMode={hardMode}
              epochRef={epochRef}
              onDone={handleWordCharDone}
            />
          )}
        </>
      ) : currentItem.kind === "pinyin" ? (
        <TestPinyinInput
          key={currentItem.id}
          hanzi={currentItem.hanzi}
          answer={currentItem.pinyin ?? ""}
          onDone={handlePinyinDone}
        />
      ) : (
        <PassageSession
          key={currentItem.id}
          itemId={currentItem.id}
          hanzi={currentItem.hanzi}
          hardMode={hardMode}
          reveal={passageReveal}
          epochRef={epochRef}
          onDone={handlePassageDone}
        />
      )}

      {showCapModal && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: "rgba(29,42,51,.4)", zIndex: 90 }}
        >
          <div className="card p-6 flex flex-col gap-4 max-w-xs w-full">
            <p className="font-semibold text-center">Save and finish tomorrow?</p>
            <button type="button" className="btn btn-primary" onClick={handleSaveAndStop}>
              Save & stop
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleKeepGoing}>
              Keep going
            </button>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}
