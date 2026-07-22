// Narration wrapper: fetches real neural speech from Google Cloud
// Text-to-Speech via /api/tts, falling back to the browser's Web Speech API
// if that request fails (offline, TTS misconfigured, etc.) — callers never
// need to know which path actually spoke.

// Chrome garbage-collects a SpeechSynthesisUtterance that has no surviving
// reference, which cuts audio off mid-word. Keeping the latest one alive
// here prevents that (fallback path only).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let currentUtterance: SpeechSynthesisUtterance | null = null;
let currentAudio: HTMLAudioElement | null = null;

const PUNCTUATION_NAMES: Record<string, string> = {
  "，": "逗号",
  "。": "句号",
  "！": "感叹号",
  "？": "问号",
  "；": "分号",
  "、": "顿号",
};

/** Punctuation marks embedded mid-utterance are frequently swallowed
 * silently by a speech engine (treated as a prosodic pause, not something
 * to say) even though a 默写 test child needs to actually hear that a
 * comma/period/etc. belongs at that position. Spelling each mark out by
 * name (逗号/句号/…) makes it audible regardless of position — applies to
 * both the Google TTS request text and the Web Speech fallback. */
function namePunctuation(text: string): string {
  return Array.from(text)
    .map((ch) => PUNCTUATION_NAMES[ch] ?? ch)
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

/** The one place that controls how fast a phrase/sentence (as opposed to a
 * single character) is read aloud, across Learn, Test, and Dictation.
 * Tune this single value to change the pace everywhere at once. */
export const PHRASE_RATE = 0.45;

// object-URL cache keyed by prepared text + lang + rate — avoids re-fetching
// audio for text this session has already narrated (e.g. Replay buttons).
const audioCache = new Map<string, Promise<string>>();

function cacheKey(prepared: string, lang: string, rate: number) {
  return `${lang}|${rate}|${prepared}`;
}

async function fetchAudioUrl(prepared: string, lang: string, rate: number): Promise<string> {
  const key = cacheKey(prepared, lang, rate);
  const cached = audioCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: prepared, lang, rate }),
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
  const prepared = namePunctuation(text);
  try {
    const url = await fetchAudioUrl(prepared, lang, rate);
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

export function speak(text: string, lang = "zh-CN", rate = 1) {
  stopCurrent();
  playOne(text, lang, rate);
}

/** Speaks a single character or word — kept as a named alias so call sites
 * read clearly. */
export function speakChar(char: string, lang = "zh-CN", rate = 1) {
  speak(char, lang, rate);
}

function playSequenceFrom(texts: string[], i: number, lang: string, rate: number) {
  if (i >= texts.length) return;
  playOne(texts[i], lang, rate, () => playSequenceFrom(texts, i + 1, lang, rate));
}

/** Speaks each string in order, only starting the next once the previous
 * utterance finishes — e.g. announcing a whole test word before the
 * specific character being tested. No gap is inserted between them beyond
 * each utterance's own natural pause. */
export function speakSequence(texts: string[], lang = "zh-CN", rate = 1) {
  stopCurrent();
  playSequenceFrom(texts, 0, lang, rate);
}

function playPausedFrom(
  texts: string[],
  i: number,
  lang: string,
  rate: number,
  pauseMs: number
) {
  if (i >= texts.length) return;
  playOne(texts[i], lang, rate, () => {
    setTimeout(() => playPausedFrom(texts, i + 1, lang, rate, pauseMs), pauseMs);
  });
}

/** Speaks each string one at a time with a deliberate silent gap between
 * them — e.g. reading a full passage slowly with a beat between characters
 * so a child can follow along, rather than one continuous utterance where
 * the browser controls (or skips) prosody pauses. */
export function speakSequencePaused(
  texts: string[],
  lang = "zh-CN",
  rate = 1,
  pauseMs = 350
) {
  stopCurrent();
  playPausedFrom(texts, 0, lang, rate, pauseMs);
}
