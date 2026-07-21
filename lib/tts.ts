// Thin wrapper over the Web Speech API for the Learn set-complete "太棒了" cue.

// Chrome garbage-collects a SpeechSynthesisUtterance that has no surviving
// reference, which cuts audio off mid-word. Keeping the latest one alive
// here prevents that.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let currentUtterance: SpeechSynthesisUtterance | null = null;

const PUNCTUATION_NAMES: Record<string, string> = {
  "，": "逗号",
  "。": "句号",
  "！": "感叹号",
  "？": "问号",
  "；": "分号",
  "、": "顿号",
};

/** Every utterance in this file is run through this before being spoken —
 * the single place both narration rules live.
 *
 * 1. Punctuation marks embedded mid-utterance are frequently swallowed
 *    silently by the speech engine (it treats them as a prosodic pause, not
 *    something to say) even though a 默写 test child needs to actually hear
 *    that a comma/period/etc. belongs at that position. Spelling each mark
 *    out by name (逗号/句号/…) makes it audible regardless of position.
 * 2. The engine treats an utterance as "done" the instant its last audible
 *    sound ends and cuts it off with no room for the natural decay a
 *    longer phrase gets for free — most noticeable on a single syllable.
 *    A trailing Chinese comma is a silent prosodic pause to the engine
 *    (never itself pronounced as a word), just padding to speak past.
 */
function prepareSpeech(text: string): string {
  const spoken = Array.from(text)
    .map((ch) => PUNCTUATION_NAMES[ch] ?? ch)
    .join("");
  return `${spoken}，`;
}

/** The one place that controls how fast a phrase/sentence (as opposed to a
 * single character) is read aloud, across Learn, Test, and Dictation.
 * Tune this single value to change the pace everywhere at once. */
export const PHRASE_RATE = 0.45;

export function speak(text: string, lang = "zh-CN", rate = 1) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(prepareSpeech(text));
  utterance.lang = lang;
  utterance.rate = rate;
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

/** Speaks a single character or word — kept as a named alias so call sites
 * read clearly, but the anti-cutoff padding lives in speak() itself. */
export function speakChar(char: string, lang = "zh-CN", rate = 1) {
  speak(char, lang, rate);
}

/** Speaks each string in order, only starting the next once the previous
 * utterance finishes — e.g. announcing a whole test word before the
 * specific character being tested. No gap is inserted between them beyond
 * each utterance's own natural pause. */
export function speakSequence(texts: string[], lang = "zh-CN", rate = 1) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const [first, ...rest] = texts;
  if (first === undefined) return;
  const utterance = new SpeechSynthesisUtterance(prepareSpeech(first));
  utterance.lang = lang;
  utterance.rate = rate;
  if (rest.length > 0) {
    utterance.onend = () => speakSequence(rest, lang, rate);
  }
  currentUtterance = utterance;
  setTimeout(() => {
    synth.resume();
    synth.speak(utterance);
  }, 0);
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
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  synth.cancel();

  function playAt(i: number) {
    if (i >= texts.length) return;
    const utterance = new SpeechSynthesisUtterance(prepareSpeech(texts[i]));
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.onend = () => {
      setTimeout(() => playAt(i + 1), pauseMs);
    };
    currentUtterance = utterance;
    synth.speak(utterance);
  }

  setTimeout(() => {
    synth.resume();
    playAt(0);
  }, 0);
}
