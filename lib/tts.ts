// Narration wrapper: fetches real neural speech from Google Cloud
// Text-to-Speech via /api/tts, falling back to the browser's Web Speech API
// if that request fails (offline, TTS misconfigured, etc.) — callers never
// need to know which path actually spoke.

import { hasPunctuation, type PunctuationChar } from "@/lib/hanzi";

// Chrome garbage-collects a SpeechSynthesisUtterance that has no surviving
// reference, which cuts audio off mid-word. Keeping the latest one alive
// here prevents that (fallback path only).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let currentUtterance: SpeechSynthesisUtterance | null = null;
let currentAudio: HTMLAudioElement | null = null;

// Bumped by stopCurrent() so any in-flight multi-segment sequence (see
// playSequenceFrom/playPausedSequenceFrom) can tell it's been superseded.
// stopCurrent() only knows how to cancel a currently-*playing* <audio>
// element — it has no way to cancel a pending setTimeout sitting between
// two segments of a paused sequence, so without this a stale sequence
// would resume and play its next segment on top of whatever a later
// narration call started.
let narrationEpoch = 0;

// Typed against lib/hanzi's canonical PUNCTUATION_CHARS: adding a mark
// there without giving it a spoken name here is a compile error, rather
// than a mark that silently never gets narrated.
const PUNCTUATION_NAMES: Record<PunctuationChar, string> = {
  "，": "逗号",
  "。": "句号",
  "！": "感叹号",
  "？": "问号",
  "；": "分号",
  "、": "顿号",
  "：": "冒号",
  "“": "前引号",
  "”": "后引号",
  "「": "前引号",
  "」": "后引号",
};

/** Punctuation marks embedded mid-utterance are frequently swallowed
 * silently by a speech engine (treated as a prosodic pause, not something
 * to say) even though a 默写 test child needs to actually hear that a
 * comma/period/etc. belongs at that position. Spelling each mark out by
 * name (逗号/句号/…) makes it audible regardless of position — applies
 * unconditionally, in every context, to both the Google TTS request text
 * and the Web Speech fallback. Sent as plain text with no SSML — every
 * SSML feature tried for Mandarin on this API (<break> pauses,
 * <say-as interpret-as="characters">, <phoneme> pronunciation override)
 * either distorted the audio or was silently ignored; pacing is
 * speakingRate-only. */
function namePunctuation(text: string): string {
  return Array.from(text)
    .map((ch) => PUNCTUATION_NAMES[ch as PunctuationChar] ?? ch)
    .join("");
}

/** A real synthesized MP3 (Google TTS) has natural trailing decay/silence,
 * so no extra padding is needed for it — only the Web Speech fallback
 * engine cuts an utterance off the instant its last audible sound ends,
 * with no room for a longer phrase's natural decay (most noticeable on a
 * single syllable). A trailing Chinese comma is a silent prosodic pause to
 * that engine (never itself pronounced as a word), just padding to speak
 * past — so it's added only when preparing text for that fallback path. */
function padForFallback(text: string): string {
  return `${text}，`;
}

/** Every narration call site names its own rate from this fixed set —
 * there is no shared/implicit default. This is deliberate: an earlier
 * design had one flat rate with a hardcoded exception for single
 * characters, and that exception was reintroduced as a bug twice by call
 * sites that forgot to override it. Naming the rate explicitly at every
 * call site removes that failure mode entirely. Each value here was
 * chosen by ear on the current voice (see app/api/tts/route.ts's
 * VOICE_NAME) — re-verify for muffling/distortion before changing any of
 * them or switching voices. */
export const CHAR_RATE = 1;
export const WORD_RATE = 0.8;
export const DICTATION_RATE = 0.65;
export const PRAISE_RATE = 1;

// object-URL cache keyed by text + lang + rate — avoids re-fetching audio
// for text this session has already narrated (e.g. Replay buttons).
const audioCache = new Map<string, Promise<string>>();

function cacheKey(text: string, lang: string, rate: number) {
  return `${lang}|${rate}|${text}`;
}

async function fetchAudioUrl(text: string, lang: string, rate: number): Promise<string> {
  const key = cacheKey(text, lang, rate);
  const cached = audioCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang, rate }),
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
  narrationEpoch++;
  if (currentAudio) {
    currentAudio.onended = null;
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function fallbackSpeak(text: string, lang: string, rate: number, onend?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onend?.();
    return;
  }
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(padForFallback(namePunctuation(text)));
  utterance.lang = lang;
  utterance.rate = rate;
  if (onend) utterance.onend = onend;
  currentUtterance = utterance;
  // Chrome can silently drop a speak() issued in the same tick as cancel()
  // (the cancellation hasn't actually finished yet) — deferring one tick
  // and nudging resume() (Chrome also auto-pauses the queue after ~15s
  // idle) makes this reliable instead of intermittently silent.
  setTimeout(() => {
    synth.resume();
    synth.speak(utterance);
  }, 0);
}

async function playOne(text: string, lang: string, rate: number, onend?: () => void) {
  const spoken = namePunctuation(text);
  try {
    const url = await fetchAudioUrl(spoken, lang, rate);
    const audio = new Audio(url);
    currentAudio = audio;
    audio.onended = () => {
      currentAudio = null;
      onend?.();
    };
    audio.onerror = () => fallbackSpeak(text, lang, rate, onend);
    await audio.play();
  } catch {
    fallbackSpeak(text, lang, rate, onend);
  }
}

/** Low-level escape hatch: speaks `text` flat at whatever `rate` is given,
 * with no punctuation segmentation. Only the Revision feature calls this
 * directly (as `speak(hanzi)`, taking the default rate). New TingXie code
 * should use the intent functions at the bottom of this file instead —
 * they pick the rate and pacing for you, which is the whole point. */
export function speak(text: string, lang = "zh-CN", rate: number = WORD_RATE) {
  stopCurrent();
  playOne(text, lang, rate);
}

const DICTATION_PAUSE_MS = 450;

// Only a comma or full stop earns a deliberate pause — a child needs time
// to actually write that character before the next clause starts. Other
// marks (colon, dialogue quotes, etc.) are still spoken (namePunctuation
// names them by voice) but don't interrupt the flow of the sentence, since
// grammatically they don't mark a place to pause writing.
const PAUSE_PUNCTUATION = new Set(["，", "。"]);

/** Splits only at a comma/full-stop, keeping everything before it attached
 * (so words/clauses, and any non-pausing punctuation inside them, are still
 * spoken together as one utterance — only a ，/。 boundary gets a
 * deliberate gap). Each segment still contains its own trailing punctuation
 * char; playOne's namePunctuation() call speaks it by name as usual. */
function segmentByPunctuation(text: string): string[] {
  const segments: string[] = [];
  let current = "";
  for (const ch of Array.from(text)) {
    current += ch;
    if (PAUSE_PUNCTUATION.has(ch)) {
      segments.push(current);
      current = "";
    }
  }
  if (current) segments.push(current);
  return segments;
}

// Kicks off the network fetch for a segment's audio without awaiting or
// playing it — called for the *next* segment as soon as the current one
// starts, so its clip is already cached by the time the pause between them
// ends. Without this, playOne's fetchAudioUrl() call for each segment only
// starts after the previous segment finishes, and on a real network that
// round-trip can easily outlast the fixed pause — reading as narration
// having stopped rather than merely buffering the next clip.
function prefetchSegment(text: string, lang: string, rate: number) {
  fetchAudioUrl(namePunctuation(text), lang, rate).catch(() => {});
}

function playPausedSequenceFrom(
  segments: string[],
  i: number,
  lang: string,
  rate: number,
  pauseMs: number,
  epoch: number
) {
  if (epoch !== narrationEpoch) return;
  if (i >= segments.length) return;
  if (i + 1 < segments.length) prefetchSegment(segments[i + 1], lang, rate);
  playOne(segments[i], lang, rate, () => {
    if (epoch !== narrationEpoch) return;
    setTimeout(() => playPausedSequenceFrom(segments, i + 1, lang, rate, pauseMs, epoch), pauseMs);
  });
}

// ---------------------------------------------------------------------------
// Intent-based API — prefer these over the primitives above.
//
// Call sites should say WHAT they're narrating, not how. The rate and the
// punctuation/segmentation policy for each kind of content are decided once,
// here, so the same kind of content is always spoken the same way on every
// screen.
//
// This exists because the policy used to be re-decided at each of ~11 call
// sites, and they drifted: the Reader ("Dictation") screen was reading full
// punctuated sentences with the flat speak() — no writing pauses — while
// Learn and Test used the paused speakDictation() for the identical content,
// and Reader's "read first 2" used the choppy per-character speakSequence()
// long after Test had moved to a single clean clip. Both were the same bug
// reported twice on two screens. Routing through these functions makes that
// class of drift impossible: fix the pacing here and every surface follows.
//
// The primitives above (speak/speakDictation/speakSequence/speakFirstChars)
// keep their signatures for the Revision feature's existing call sites — new
// TingXie code should reach for the intent functions instead.
// ---------------------------------------------------------------------------

/** A single character in isolation — e.g. tapping one char to hear it. */
export function speakChar(char: string) {
  stopCurrent();
  playOne(char, "zh-CN", CHAR_RATE);
}

/** A word or short phrase prompt (word list, pinyin drill, test prompt).
 * Automatically upgrades to punctuation-paused narration when the text
 * turns out to be a 默写 passage sentence rather than a plain word — only
 * passages ever embed punctuation, so no caller needs to pass `kind`. */
export function speakWord(text: string) {
  if (hasPunctuation(text)) {
    speakPassage(text);
    return;
  }
  stopCurrent();
  playOne(text, "zh-CN", WORD_RATE);
}

/** A full 默写 sentence, read at dictation pace with a real pause after
 * every ，/。 so the child has time to write it before the next clause
 * starts.
 *
 * The pause is a genuine gap between separate audio clips, not markup:
 * SSML <break> was tried for this and silently distorts or truncates audio
 * on this API (see namePunctuation's comment above). */
export function speakPassage(text: string) {
  stopCurrent();
  playPausedSequenceFrom(
    segmentByPunctuation(text),
    0,
    "zh-CN",
    DICTATION_RATE,
    DICTATION_PAUSE_MS,
    narrationEpoch
  );
}

/** Just the opening `count` characters of a passage, synthesized as one
 * clip — the "read first 2 words" hint.
 *
 * Two rejected alternatives, both of which shipped and were reported as
 * bugs: (a) synthesizing the whole sentence and pausing mid-clip at an
 * estimated duration-proportion, which cut off mid-syllable because the
 * estimate assumes even pacing per character and speech isn't paced that
 * way; (b) speaking the characters as N separate one-character clips,
 * which sounds choppy and robotic. Synthesizing exactly the opening
 * substring trades a little cross-sentence prosody for a clip that starts
 * and ends cleanly, with the characters still spoken together naturally. */
export function speakPassageOpening(text: string, count: number) {
  const opening = Array.from(text).slice(0, count).join("");
  stopCurrent();
  playOne(opening, "zh-CN", DICTATION_RATE);
}

/** Celebration/encouragement line, spoken at conversational speed. */
export function speakPraise(text: string) {
  stopCurrent();
  playOne(text, "zh-CN", PRAISE_RATE);
}

/** Stops whatever is currently narrating (Google TTS audio or the Web
 * Speech fallback) immediately — call this on unmount for any
 * screen/component that can call speak()/speakSequence(), so navigating
 * away mid-narration doesn't leave audio playing over the next page. */
export function stopNarration() {
  stopCurrent();
}
