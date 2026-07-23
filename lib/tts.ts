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
 * name (逗号/句号/…) makes it audible regardless of position — applies
 * unconditionally, in every context, to both the Google TTS request text
 * and the Web Speech fallback. Sent as plain text with no SSML — every
 * SSML feature tried for Mandarin on this API (<break> pauses,
 * <say-as interpret-as="characters">, <phoneme> pronunciation override)
 * either distorted the audio or was silently ignored; pacing is
 * speakingRate-only. */
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

/** `rate` is required, not defaulted — callers must name one of
 * CHAR_RATE/WORD_RATE/DICTATION_RATE/PRAISE_RATE explicitly (see the
 * comment above that set). The Revision feature's own narration calls
 * predate this and only pass `text`, so `rate` keeps a default purely for
 * that backward compatibility — every TingXie call site should still pass
 * it explicitly rather than relying on the default. */
export function speak(text: string, lang = "zh-CN", rate: number = WORD_RATE) {
  stopCurrent();
  playOne(text, lang, rate);
}

function playSequenceFrom(texts: string[], i: number, lang: string, rate: number) {
  if (i >= texts.length) return;
  playOne(texts[i], lang, rate, () => playSequenceFrom(texts, i + 1, lang, rate));
}

/** Speaks each string in order, only starting the next once the previous
 * utterance finishes — e.g. Dictation's "read first 2 words" hint. No gap
 * is inserted between them beyond each utterance's own natural pause. */
export function speakSequence(texts: string[], lang = "zh-CN", rate: number = DICTATION_RATE) {
  stopCurrent();
  playSequenceFrom(texts, 0, lang, rate);
}

/** A brief silent gap between the phrase and the character in
 * speakWordThenChar — with zero gap, the character's audio starts the
 * instant the phrase's onended fires, cutting off the phrase's own
 * trailing decay and making it sound abruptly cut short instead of
 * naturally finished. */
const WORD_TO_CHAR_PAUSE_MS = 100;

/** Announces a whole word/phrase at `wordRate`, pauses briefly, then
 * announces the specific character being practised alone at CHAR_RATE —
 * used by Test's word/passage quiz for "say the word, then the
 * character," repeated each time the child advances to the next
 * character and auto-playing as the item/character changes (callers
 * trigger this from a mount-keyed effect, not from here). A rare
 * polyphonic character (e.g. 乐, yuè in 乐曲 but lè elsewhere) can default
 * to the wrong reading when spoken in total isolation like this — several
 * fixes were tried (SSML emphasis/prosody/say-as/phoneme, muting
 * neighboring characters, word substitution per known-polyphonic
 * character) and each either distorted the audio, was silently ignored,
 * still mispronounced, or added more complexity than the edge case
 * warranted — so this accepts that narrow edge case in exchange for
 * narration that's simple and reliably audible for every word.
 *
 * The character always plays at CHAR_RATE regardless of `wordRate` — a
 * single syllable played at anything other than natural speed comes out
 * faded/muffled on this voice. */
export function speakWordThenChar(word: string, char: string, wordRate: number, lang = "zh-CN") {
  stopCurrent();
  if (Array.from(word).length <= 1) {
    // Nothing to announce separately — the word already is the character.
    playOne(word, lang, CHAR_RATE);
    return;
  }
  playOne(word, lang, wordRate, () => {
    setTimeout(() => playOne(char, lang, CHAR_RATE), WORD_TO_CHAR_PAUSE_MS);
  });
}

/** Stops whatever is currently narrating (Google TTS audio or the Web
 * Speech fallback) immediately — call this on unmount for any
 * screen/component that can call speak()/speakSequence()/
 * speakWordThenChar(), so navigating away mid-narration doesn't leave
 * audio playing over the next page. */
export function stopNarration() {
  stopCurrent();
}
