"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { speak } from "@/lib/tts";
import type { AttemptMode } from "@/lib/supabase/types";
import type { ItemResult } from "@/lib/testTypes";
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
}: {
  childId: string;
  listId: string;
  mode: AttemptMode;
  supervised: boolean;
  hardMode: boolean;
  guessPct: number;
  items: TestItem[];
}) {
  const router = useRouter();
  const epochRef = useRef(0);
  const resultsRef = useRef<ItemResult[]>([]);
  const sessionStartRef = useRef(now());
  const capThresholdRef = useRef(CAP_MS);
  const wordCharResultsRef = useRef<boolean[]>([]);
  const spokenItemRef = useRef<string | null>(null);

  const [queueIndex, setQueueIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [showCapModal, setShowCapModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.body.classList.add("test-mode");
    return () => document.body.classList.remove("test-mode");
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - sessionStartRef.current >= capThresholdRef.current) {
        setShowCapModal(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentItem = items[queueIndex];

  useEffect(() => {
    if (currentItem?.kind === "words" && spokenItemRef.current !== currentItem.id) {
      spokenItemRef.current = currentItem.id;
      speak(currentItem.hanzi);
    }
  }, [currentItem]);

  async function submitAttempt(itemResults: ItemResult[]) {
    setSubmitting(true);
    const supabase = createClient();
    const durationS = Math.round((Date.now() - sessionStartRef.current) / 1000);
    const { data: attemptId, error } = await supabase.rpc("record_test_attempt", {
      child_id: childId,
      list_id: listId,
      mode,
      supervised,
      guess_pct: guessPct,
      duration_s: durationS,
      item_results: itemResults,
    });
    if (error) {
      setSubmitting(false);
      return;
    }
    router.push(`/kid/${childId}/list/${listId}/results/${attemptId}`);
  }

  function advance() {
    wordCharResultsRef.current = [];
    setCharIndex(0);
    if (queueIndex + 1 >= items.length) {
      submitAttempt(resultsRef.current);
    } else {
      setQueueIndex((i) => i + 1);
    }
  }

  function handleWordCharDone(result: { passed: boolean }) {
    const chars = Array.from(currentItem.hanzi);
    wordCharResultsRef.current.push(result.passed);

    if (charIndex + 1 < chars.length) {
      setCharIndex((i) => i + 1);
      return;
    }

    const passed = wordCharResultsRef.current.every(Boolean);
    resultsRef.current.push({ item_id: currentItem.id, kind: "words", passed });
    advance();
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
      <div className="card p-8 text-center" style={{ color: "var(--mut)" }}>
        Nothing to test here yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
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
      ) : currentItem.kind === "words" ? (
        <TestCharQuiz
          key={`${currentItem.id}-${charIndex}`}
          char={Array.from(currentItem.hanzi)[charIndex]}
          hardMode={hardMode}
          epochRef={epochRef}
          onDone={handleWordCharDone}
        />
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
  );
}
