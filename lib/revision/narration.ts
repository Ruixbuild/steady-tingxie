// Revision's own narration mechanism — calls /api/tts directly instead of
// going through lib/tts.ts's speak()/speakPaced(). Two things were tried
// and rejected before this:
//
// 1. speak(text) with punctuation left in: lib/tts.ts's playOne() *always*
//    runs text through namePunctuation(), which spells full-width Chinese
//    marks out by name (，-> "逗号") — necessary for TingXie's dictation
//    tests (a child needs to literally hear where a mark belongs) but wrong
//    for Revision's plain-reading sentences/definitions.
// 2. speak(text) with punctuation stripped or swapped for ASCII: fixed the
//    naming problem but removed/broke the pause entirely — this Google
//    voice doesn't reliably treat in-text punctuation as a pause cue at
//    all. That's *why* lib/tts.ts's own speakPaced() creates pauses as a
//    real timed gap between separately-synthesized audio clips rather than
//    trusting the engine to interpret a comma (see its doc comment) — but
//    speakPaced() still runs each segment through namePunctuation() too, so
//    it isn't reusable here either, and its segmentation helpers aren't
//    exported.
//
// So: Revision builds its own version of that same "real gap between
// clips" mechanism, but strips the pause mark from each segment's text
// before requesting audio — the pause comes from the timed gap this file
// inserts between clips, not from Google's interpretation of the character,
// so there's nothing left for a punctuation-naming step to even act on.

import { PUNCTUATION_CHARS, type PunctuationChar } from "@/lib/hanzi";

const STRIP_RE = new RegExp(`[${PUNCTUATION_CHARS.join("")}]`, "g");

/** Full removal — used for short vocab words (WriteCard's word/announceWord
 * props), which shouldn't contain sentence punctuation in the first place. */
export function stripPunctuation(text: string): string {
  return text.replace(STRIP_RE, "");
}

// Marks that earn a real pause after them. Quote marks carry no pause
// meaning and are just dropped.
const PAUSE_CHARS = new Set(["，", "。", "！", "？", "；", "、"]);
const QUOTE_CHARS = new Set<PunctuationChar>(["“", "”", "「", "」"]);

function segmentText(text: string): string[] {
  const segments: string[] = [];
  let current = "";
  for (const ch of Array.from(text)) {
    if (PAUSE_CHARS.has(ch)) {
      if (current) segments.push(current);
      current = "";
    } else if (!QUOTE_CHARS.has(ch as PunctuationChar)) {
      current += ch;
    }
  }
  if (current) segments.push(current);
  return segments;
}

const REVISION_RATE = 0.8;
const PAUSE_MS = 220;

let currentAudio: HTMLAudioElement | null = null;
let epoch = 0;
const audioCache = new Map<string, Promise<string>>();

async function fetchClip(text: string): Promise<string> {
  const key = `${REVISION_RATE}|${text}`;
  const cached = audioCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang: "zh-CN", rate: REVISION_RATE }),
    });
    if (!res.ok) throw new Error(`tts fetch failed: ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  })();
  audioCache.set(key, promise);
  promise.catch(() => audioCache.delete(key));
  return promise;
}

function stopCurrent() {
  epoch++;
  if (currentAudio) {
    currentAudio.onended = null;
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function fallbackSpeak(text: string, onend: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onend();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = REVISION_RATE;
  utterance.onend = onend;
  // Chrome can silently drop a speak() issued in the same tick as cancel().
  setTimeout(() => {
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  }, 0);
}

function playSegment(text: string, myEpoch: number, onend: () => void) {
  fetchClip(text)
    .then((url) => {
      if (epoch !== myEpoch) return;
      const audio = new Audio(url);
      currentAudio = audio;
      audio.onended = () => {
        if (epoch !== myEpoch) return;
        currentAudio = null;
        onend();
      };
      audio.onerror = () => fallbackSpeak(text, onend);
      audio.play().catch(() => fallbackSpeak(text, onend));
    })
    .catch(() => {
      if (epoch !== myEpoch) return;
      fallbackSpeak(text, onend);
    });
}

function playFrom(segments: string[], i: number, myEpoch: number) {
  if (epoch !== myEpoch) return;
  if (i >= segments.length) return;
  playSegment(segments[i], myEpoch, () => {
    if (epoch !== myEpoch) return;
    setTimeout(() => playFrom(segments, i + 1, myEpoch), PAUSE_MS);
  });
}

/** Revision's one narration entry point. Splits `text` at 、，。！？；
 * boundaries and plays each piece as its own clip with a real gap between
 * them — see this file's header comment for why that's necessary here. */
export function speakRevision(text: string): void {
  stopCurrent();
  const myEpoch = epoch;
  playFrom(segmentText(text), 0, myEpoch);
}
