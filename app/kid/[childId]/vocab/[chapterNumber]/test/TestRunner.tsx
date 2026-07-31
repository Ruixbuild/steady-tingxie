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
import { prefetchRevision, speakRevision } from "@/lib/revision/narration";
import { submitWordAttempt, type CharResult } from "@/lib/revision/testActions";
import {
  blankPairing,
  findPairingWithWord,
  pickReadDistractors,
  shuffle,
  splitPairingAroundWord,
} from "@/lib/revision/testScoring";
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
  learntWords,
  modeLabel,
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
  /** Words (any chapter) this child already has read-mastery for — the
   * fallback distractor pool for pickReadDistractors when the current
   * chapter alone doesn't have enough same-length words. */
  learntWords: RevisionVocab[];
  /** Overrides the default skill+level title (e.g. "tricky words only"
   * mode) — falls back to TITLE below when omitted. */
  modeLabel?: string;
}) {
  const router = useRouter();

  // Level 2 needs a pairing containing the word to blank out — words
  // without one are skipped from that level's queue.
  //
  // Snapshotted once via a lazy useState initializer, NOT a useMemo keyed
  // on `words` — the tricky-words-only mode's word list is itself derived
  // from live mastery (TestHost's readTrickyWords), and router.refresh()
  // at the end of this very run updates that mastery, which would
  // otherwise shrink `words` (a just-passed word is no longer tricky) and
  // recompute a smaller queue out from under an already-finished run.
  // Passing every tricky word then flipped `queue.length` to 0 and kicked
  // the results screen straight back to the "Nothing to test here yet"
  // early return instead — the "closes abruptly to a blank page" bug. A
  // test's word list has to stay fixed for the run it was built for.
  //
  // Shuffled (not just filtered) so the word order itself varies between
  // runs — otherwise a child re-testing the same chapter sees an identical
  // sequence every time and can memorize "3rd question is always X"
  // without actually recognizing the word.
  const [queue] = useState(() =>
    shuffle(level === 1 ? words : words.filter((w) => findPairingWithWord(w) !== null))
  );

  const [index, setIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  // Mirrors TingXie's own TestSession: once a multi-char 识写 word's last
  // character is written, the queue pauses on a "Done ✔ — <word> / Next →"
  // confirmation instead of auto-advancing, with the boxes above revealing
  // each finished character's glyph. Previously this screen advanced
  // straight to the next word the instant the last stroke quiz completed,
  // with no box row at all — every character stayed invisible even after
  // being written correctly.
  const [wordItemDone, setWordItemDone] = useState(false);
  const [results, setResults] = useState<WordResult[]>([]);
  const [finished, setFinished] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
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
  // A failed write (e.g. a flaky connection mid-test) used to be swallowed
  // completely, with nothing telling the child/parent that word's mastery
  // wasn't actually recorded despite the results screen showing a normal
  // score (score is computed from the client-known `passed` value, not
  // from whether the write succeeded). Counted here and surfaced on the
  // results screen so a "score looks right but mastery didn't move" report
  // is diagnosable instead of silent.
  const failedWritesRef = useRef(0);
  // Captures the first failure's raw message — the generic "didn't save"
  // copy on the results screen isn't enough to tell a real connectivity
  // drop apart from e.g. an RLS/RPC error, and iPhone Safari has no easy
  // way to inspect the network tab to find out which.
  const lastErrorRef = useRef<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const current = queue[index];

  // findPairingWithWord now picks randomly among the word's eligible
  // pairings (so repeating the test doesn't show the same question every
  // time) — memoized per item (not just computed inline) so it stays
  // reused for both the blanked prompt and the full-phrase reveal below,
  // and stays stable across any incidental re-render while the same
  // question is still showing rather than re-randomizing mid-question.
  // Declared before handleStrokeCharDone (which reads it to speak the
  // completed phrase once Level 2's boxes finish) and before the early
  // returns below, since it's a Hook — `current` can be undefined once
  // the queue is exhausted, hence the guard.
  const currentPairing = useMemo(
    () => (current && level === 2 ? findPairingWithWord(current) : null),
    [current, level]
  );

  function handleReadDone(passed: boolean) {
    // Fire-and-forget: submitting the RPC doesn't block advancing to the
    // next word. Awaiting it here (the original approach) stacked a network
    // round-trip on top of TestReadQuiz's ~900ms reveal delay, pushing the
    // gap between the child's tap and the next word's auto-play call past
    // the browser's recent-user-activation window — which is what made
    // audio silently stop auto-playing from the second word onward.
    pendingWritesRef.current.push(
      submitWordAttempt(childId, current.id, "read", level, { passed }).catch((err) => {
        // Best-effort — the session stays usable even if one write hiccups;
        // that word just won't have this attempt recorded.
        failedWritesRef.current += 1;
        lastErrorRef.current = err instanceof Error ? err.message : String(err);
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
    // Fire-and-forget, same reasoning as handleReadDone: the graded verdict
    // (only known once the RPC resolves, since 识写 pass/fail is computed
    // server-side) is appended to results whenever it arrives rather than
    // blocking. Unlike handleReadDone though, this no longer advances the
    // queue immediately — it pauses on the "Done ✔" confirmation below
    // (advanceWordItem) so the child sees every character's box filled in
    // before moving on, matching TingXie's own TestSession.
    pendingWritesRef.current.push(
      submitWordAttempt(childId, current.id, "write", level, { charResults })
        .then((res) => {
          setResults((r) => [...r, { vocabId: finishedVocabId, hanzi: finishedHanzi, passed: res.item_passed }]);
        })
        .catch((err) => {
          failedWritesRef.current += 1;
          lastErrorRef.current = err instanceof Error ? err.message : String(err);
          setResults((r) => [...r, { vocabId: finishedVocabId, hanzi: finishedHanzi, passed: false }]);
        })
    );
    charResultsRef.current = [];
    setWordItemDone(true);
    // Level 2's boxes just finished filling in with the written word --
    // read the whole phrase back, same as 识读 Level 2's reveal, so the
    // child hears the completed sentence rather than just seeing it.
    if (level === 2 && currentPairing) speakRevision(currentPairing);
  }

  function advanceWordItem() {
    setWordItemDone(false);
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

  // Warms the current word's pairing phrase as soon as it's known — for
  // Level 2, the full sentence isn't spoken until the boxes finish filling
  // in (handleStrokeCharDone/TestReadQuiz's reveal), which is however long
  // the child takes to write or pick. Without this, that speakRevision call
  // hit a cold /api/tts fetch right when it mattered most, reading as a
  // noticeable lag before the completed phrase played.
  useEffect(() => {
    if (level === 2 && currentPairing) prefetchRevision(currentPairing);
  }, [level, currentPairing]);

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
        setFailedCount(failedWritesRef.current);
        setLastError(lastErrorRef.current);
        setFinished(true);
      });
    }
  }, [results, queue.length, childId, chapterNumber, skill, level, router]);

  // 识写 Level 2's pairing split around the target word, so its writing
  // boxes can render embedded at that position in the sentence instead of
  // a "＿" placeholder in the text with a disconnected box row below it.
  const writePairingParts = useMemo(
    () =>
      current && skill === "write" && level === 2 && currentPairing
        ? splitPairingAroundWord(currentPairing, current.hanzi)
        : null,
    [current, skill, level, currentPairing]
  );

  // Memoized per word (not recomputed inline in the render body) so the
  // distractor pool and its shuffle order stay stable for as long as the
  // same question is on screen — pickReadDistractors/shuffle are both
  // randomized, so recomputing on every incidental re-render (e.g. a
  // lastError state update from a pending write elsewhere) would silently
  // reshuffle the options a child is already looking at, or even after
  // they've picked one.
  const readOptions: ReadQuizOption[] = useMemo(
    () =>
      current && skill === "read"
        ? shuffle([
            { id: current.id, hanzi: current.hanzi },
            ...pickReadDistractors(current, chapterWords, learntWords, 3).map((w) => ({ id: w.id, hanzi: w.hanzi })),
          ])
        : [],
    [current, skill, chapterWords, learntWords]
  );

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
      <ResultsScreen
        skill={skill}
        level={level}
        results={results}
        backHref={chapterHref}
        onBackToTest={onExit}
        failedCount={failedCount}
        lastError={lastError}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <p className="text-base" style={{ color: "var(--mut)" }}>
          {modeLabel ?? TITLE[skill][level]}
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
          promptText={blankPairing(currentPairing as string, current.hanzi)}
          fullPhrase={currentPairing as string}
          onDone={handleReadDone}
        />
      )}

      {skill === "write" && (
        <>
          {level === 2 && writePairingParts ? (
            // The word's writing boxes sit embedded at its actual position
            // in the sentence, rather than a "＿" placeholder in the text
            // with a disconnected box row rendered separately below it —
            // the two used to have no visual relationship to each other.
            // Sized/weighted to match 识读 Level 2's own phrase display
            // (TestReadQuiz's promptText) -- this was previously a much
            // smaller, muted text-lg/var(--mut) line with an inflated 1.8
            // line-height, both reading as too small and adding avoidable
            // vertical space that pushed "End test" further down the page
            // than the equivalent 识读 screen.
            <p className="hanzi text-3xl font-extrabold text-center">
              {writePairingParts.before}
              {strokeChars(current.hanzi).map((c, i) => {
                const done = wordItemDone || i < charIndex;
                return (
                  <span
                    key={i}
                    className="hanzi inline-flex items-center justify-center"
                    style={{
                      minWidth: 44,
                      height: 44,
                      margin: "0 3px",
                      fontSize: "1.3rem",
                      borderRadius: 12,
                      border: `1.5px solid ${done ? "var(--ok)" : "var(--line)"}`,
                      background: done ? "var(--ok-soft)" : "#fff",
                      color: "var(--ink)",
                      verticalAlign: "middle",
                    }}
                  >
                    {done ? c : ""}
                  </span>
                );
              })}
              {writePairingParts.after}
            </p>
          ) : (
            level === 1 &&
            strokeChars(current.hanzi).length > 1 && (
              <div className="flex gap-2 justify-center flex-wrap">
                {strokeChars(current.hanzi).map((c, i) => {
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
            )
          )}
          {wordItemDone ? (
            <div className="card flex flex-col items-center gap-4 py-6">
              <p className="text-base" style={{ color: "var(--mut)" }}>
                Done ✔ — {current.hanzi}
              </p>
              <button type="button" className="btn btn-primary" onClick={advanceWordItem}>
                Next →
              </button>
            </div>
          ) : (
            <StrokeTestQuiz
              key={`${current.id}-${charIndex}`}
              char={strokeChars(current.hanzi)[charIndex]}
              // Announces the target word on arrival at a new question for
              // both levels -- Level 2 embeds the word as blank boxes
              // inside a sentence, so the child still needs to be told what
              // word to write, same as Level 1's "write from memory".
              // Previously gated to level === 1 only, so Level 2 never
              // spoke anything until the child tapped "Say it again".
              announceWord={charIndex === 0 ? current.hanzi : undefined}
              word={current.hanzi}
              epochRef={epochRef}
              onDone={handleStrokeCharDone}
            />
          )}
        </>
      )}

      <button type="button" onClick={onExit} className="text-sm self-center" style={{ color: "var(--mut)" }}>
        ✕ End test
      </button>
    </div>
  );
}
