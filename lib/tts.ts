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
 * both the Google TTS request text and the Web Speech fallback. Sent as
 * plain text with no SSML/break tuning — the voice's own natural pacing
 * around a real word is relied on instead of a forced pause. */
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

// object-URL cache keyed by text + lang — avoids re-fetching audio for
// text this session has already narrated (e.g. Replay buttons).
const audioCache = new Map<string, Promise<string>>();

function cacheKey(text: string, lang: string) {
  return `${lang}|${text}`;
}

async function fetchAudioUrl(text: string, lang: string): Promise<string> {
  const key = cacheKey(text, lang);
  const cached = audioCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang }),
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

function fallbackSpeak(text: string, lang: string, onend?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onend?.();
    return;
  }
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(padForFallback(namePunctuation(text)));
  utterance.lang = lang;
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

async function playOne(text: string, lang: string, onend?: () => void) {
  const spoken = namePunctuation(text);
  try {
    const url = await fetchAudioUrl(spoken, lang);
    const audio = new Audio(url);
    currentAudio = audio;
    audio.onended = () => {
      currentAudio = null;
      onend?.();
    };
    audio.onerror = () => fallbackSpeak(text, lang, onend);
    await audio.play();
  } catch {
    fallbackSpeak(text, lang, onend);
  }
}

export function speak(text: string, lang = "zh-CN") {
  stopCurrent();
  playOne(text, lang);
}

function playSequenceFrom(texts: string[], i: number, lang: string) {
  if (i >= texts.length) return;
  playOne(texts[i], lang, () => playSequenceFrom(texts, i + 1, lang));
}

/** Speaks each string in order, only starting the next once the previous
 * utterance finishes — e.g. announcing a whole test word before the
 * specific character being tested. No gap is inserted between them beyond
 * each utterance's own natural pause. */
export function speakSequence(texts: string[], lang = "zh-CN") {
  stopCurrent();
  playSequenceFrom(texts, 0, lang);
}

/** Announces a whole word/phrase, then announces the specific character
 * being practised alone — shared by Learn's char ladder and Test's
 * word/passage quiz for "say the word, then the character," and repeated
 * each time the child advances to the next character. No artificial pause
 * is inserted between the two; the character starts as soon as the
 * phrase's own audio ends. A rare polyphonic character (e.g. 乐, yuè in
 * 乐曲 but lè elsewhere) can default to the wrong reading when spoken in
 * total isolation like this — a within-phrase <emphasis>/<prosody> wrap
 * was tried to fix that and had to be reverted (mixing tagged and
 * untagged text in one <speak> silently truncated the audio on Google
 * TTS), so this trades that narrow edge case for narration that's
 * reliably audible for every word. */
export function speakWordThenChar(word: string, char: string, lang = "zh-CN") {
  stopCurrent();
  if (Array.from(word).length <= 1) {
    // Nothing to announce separately — the word already is the character.
    playOne(word, lang);
    return;
  }
  playOne(word, lang, () => playOne(char, lang));
}

/** Stops whatever is currently narrating (Google TTS audio or the Web
 * Speech fallback) immediately — call this on unmount for any
 * screen/component that can call speak()/speakSequence()/
 * speakWordThenChar(), so navigating away mid-narration doesn't leave
 * audio playing over the next page. */
export function stopNarration() {
  stopCurrent();
}
