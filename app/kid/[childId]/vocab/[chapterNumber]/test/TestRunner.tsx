"use client";

// Orchestrates one skill+level test run: builds the word queue, delegates
// each word to the right quiz component, submits each attempt via
// submitWordAttempt, and shows ResultsScreen at the end. Deliberately no
// "test time"/hint banner and no progress bar — per the wireframe review,
// this feature stays as plain as TestSession's chrome minus that banner.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import StrokeTestQuiz from "@/app/kid/[childId]/vocab/StrokeTestQuiz";
import TestReadQuiz, { type ReadQuizOption } from "@/app/kid/[childId]/vocab/TestReadQuiz";
import ResultsScreen, { type WordResult } from "./ResultsScreen";
import { strokeChars } from "@/lib/hanzi";
import { recordTestAttempt } from "@/lib/revision/attemptActions";
import { prefetchRevision } from "@/lib/revision/narration";
import { submitWordAttempt, type CharResult } from "@/lib/revision/testActions";
import { blankPairing, findPairingWithWord, pickDistractors, shuffle } from "@/lib/revision/testScoring";
import type { RevisionVocab } from "@/lib/revision/types";

const TITLE: Record<"read" | "write", Record<1 | 2, string>> = {
  read: { 1: "识读 Level 1 — listen & pick", 2: "识读 Level 2 — match the phrase" },
  write: { 1: "识写 Level 1 — write from memory", 2: "识写 Level 2 — fill in the blank" },
};

export default function TestRunner({
  childId,
  chapterNumber,
  chapterHref,
  onExit,
  skill,
  level,
  words,
  chapterWords,
}: {
  childId: string;
  /** For persisting the finished run as one revision_attempts row — see
   * the completion effect below. */
  chapterNumber: number;
  /** Real navigation target for the results screen's "Back to chapter" —
   * a genuinely different URL, so an ordinary Link is fine there. */
  chapterHref: string;
  /** Mid-session abandon ("✕ End test") returns to the picker via the
   * parent's local state instead of navigating — TestHost renders picker
   * and runner on the same URL, so a Link back to "this" URL is a no-op. */
  onExit: () => void;
  skill: "read" | "write";
  level: 1 | 2;
  words: RevisionVocab[];
  chapterWords: RevisionVocab[];
}) {
  const router = useRouter();

  // Level 2 needs a pairing containing the word to blank out — words
  // without one are skipped from that level's queue.
  const queue = useMemo(
    () => (level === 1 ? words : words.filter((w) => findPairingWithWord(w) !== null)),
    [words, level]
  );

  const [index, setIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [results, setResults] = useState<WordResult[]>([]);
  const [finished, setFinished] = useState(false);
  const epochRef = useRef(0);
  const charResultsRef = useRef<CharResult[]>([]);
  const attemptSubmittedRef = useRef(false);
  // Every submitWordAttempt call is fire-and-forget so the quiz itself never
  // stalls on a network round-trip (see the comments below), but that means
  // `results` can reach queue.length before the *last* word's mastery write
  // has actually landed in revision_mastery. The completion effect awaits
  // this before treating the run as done, so navigating off the results
  // screen (back to the picker or the chapter page) always sees fresh
  // mastery — otherwise a fast tap right after the last question raced
  // ahead of the write and the chapter list still showed the old stage.
  const pendingWritesRef = useRef<Promise<unknown>[]>([]);

  const current = queue[index];

  function handleReadDone(passed: boolean) {
    // Fire-and-forget: submitting the RPC doesn't block advancing to the
    // next word. Awaiting it here (the original approach) stacked a network
    // round-trip on top of TestReadQuiz's ~900ms reveal delay, pushing the
    // gap between the child's tap and the next word's auto-play call past
    // the browser's recent-user-activation window — which is what made
    // audio silently stop auto-playing from the second word onward.
    pendingWritesRef.current.push(
      submitWordAttempt(childId, current.id, "read", level, { passed }).catch(() => {
        // Best-effort — the session stays usable even if one write hiccups;
        // that word just won't have this attempt recorded.
      })
    );
    setResults((r) => [...r, { vocabId: current.id, hanzi: current.hanzi, passed }]);
    setIndex((i) => i + 1);
  }

  function handleStrokeCharDone(result: { strokes: number; totalMistakes: number }) {
    charResultsRef.current.push({ strokes: result.strokes, total_mistakes: result.totalMistakes });
    const chars = strokeChars(current.hanzi);
    if (charIndex + 1 < chars.length) {
      setCharIndex((i) => i + 1);
      return;
    }
    const charResults = charResultsRef.current;
    const finishedHanzi = current.hanzi;
    const finishedVocabId = current.id;
    // Same fire-and-forget reasoning as handleReadDone — advance to the
    // next word immediately; the graded verdict (only known once the RPC
    // resolves, since 识写 pass/fail is computed server-side) is appended
    // to results whenever it arrives rather than blocking the transition.
    pendingWritesRef.current.push(
      submitWordAttempt(childId, current.id, "write", level, { charResults })
        .then((res) => {
          setResults((r) => [...r, { vocabId: finishedVocabId, hanzi: finishedHanzi, passed: res.item_passed }]);
        })
        .catch(() => {
          setResults((r) => [...r, { vocabId: finishedVocabId, hanzi: finishedHanzi, passed: false }]);
        })
    );
    charResultsRef.current = [];
    setCharIndex(0);
    setIndex((i) => i + 1);
  }

  // Prefetches the *next* item's audio while the current one is still on
  // screen, so by the time the queue advances, TestReadQuiz's promptAudio
  // auto-play (or StrokeTestQuiz's announceWord) hits an already-warm
  // cache instead of a cold /api/tts fetch. Covers the second word onward;
  // the very first word is prefetched by TestHost the moment its picker
  // card is tapped, before this component even mounts.
  useEffect(() => {
    const next = queue[index + 1];
    if (next) prefetchRevision(next.hanzi);
  }, [index, queue]);

  // Persists the whole finished run as one revision_attempts row, once —
  // gated on results.length rather than index, since a write run's last
  // word's result only lands after its grading RPC resolves (async), which
  // can trail index reaching queue.length by a beat. Fire-and-forget, same
  // reasoning as the per-word calls above: this is a history record, not
  // something the child is waiting on.
  //
  // router.refresh() here re-fetches this route's server data (the picker's
  // masteryRows, threaded down through TestHost) so that if the child taps
  // "✕ End test" back to the picker, its "suggested" level badge already
  // reflects this run's result — without it, TestHost was still holding
  // the masteryRows from before the test (it's a client component that
  // never remounts between picker and runner), so a level-1 pass wouldn't
  // bump the suggestion to level 2 until a real page navigation happened.
  useEffect(() => {
    if (queue.length > 0 && results.length === queue.length && !attemptSubmittedRef.current) {
      attemptSubmittedRef.current = true;
      Promise.allSettled(pendingWritesRef.current).then(() => {
        recordTestAttempt(childId, chapterNumber, skill, level, results).catch(() => {});
        router.refresh();
        setFinished(true);
      });
    }
  }, [results, queue.length, childId, chapterNumber, skill, level, router]);

  if (queue.length === 0) {
    return (
      <div className="card p-8 text-center" style={{ color: "var(--mut)" }}>
        Nothing to test here yet.
      </div>
    );
  }

  if (index >= queue.length) {
    if (!finished) {
      return (
        <div className="card p-8 text-center" style={{ color: "var(--mut)" }}>
          Grading…
        </div>
      );
    }
    return (
      <ResultsScreen skill={skill} level={level} results={results} backHref={chapterHref} onBackToTest={onExit} />
    );
  }

  const readOptions: ReadQuizOption[] =
    skill === "read"
      ? shuffle([
          { id: current.id, hanzi: current.hanzi },
          ...pickDistractors(current, chapterWords, 3).map((w) => ({ id: w.id, hanzi: w.hanzi })),
        ])
      : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <p className="text-base" style={{ color: "var(--mut)" }}>
          {TITLE[skill][level]}
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--mut)" }}>
          Item {index + 1} of {queue.length}
        </p>
      </div>

      {skill === "read" && level === 1 && (
        <TestReadQuiz
          key={current.id}
          targetId={current.id}
          options={readOptions}
          promptAudio={current.hanzi}
          onDone={handleReadDone}
        />
      )}

      {skill === "read" && level === 2 && (
        <TestReadQuiz
          key={current.id}
          targetId={current.id}
          options={readOptions}
          promptText={blankPairing(findPairingWithWord(current) as string, current.hanzi)}
          onDone={handleReadDone}
        />
      )}

      {skill === "write" && (
        <>
          {level === 2 && (
            <p className="hanzi text-lg text-center" style={{ color: "var(--mut)" }}>
              {blankPairing(findPairingWithWord(current) as string, current.hanzi)}
            </p>
          )}
          <StrokeTestQuiz
            key={`${current.id}-${charIndex}`}
            char={strokeChars(current.hanzi)[charIndex]}
            announceWord={charIndex === 0 && level === 1 ? current.hanzi : undefined}
            word={current.hanzi}
            epochRef={epochRef}
            onDone={handleStrokeCharDone}
          />
        </>
      )}

      <button type="button" onClick={onExit} className="text-sm self-center" style={{ color: "var(--mut)" }}>
        ✕ End test
      </button>
    </div>
  );
}
