// Thin wrapper over the Web Speech API for the Learn set-complete "太棒了" cue.

import { isPunctuationChar } from "./hanzi";

// Chrome garbage-collects a SpeechSynthesisUtterance that has no surviving
// reference, which cuts audio off mid-word. Keeping the latest one alive
// here prevents that.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let currentUtterance: SpeechSynthesisUtterance | null = null;

/** Every utterance in this file is padded through this before being spoken —
 * the single place the "don't end abruptly" rule lives. The speech engine
 * treats an utterance as "done" the instant its last audible sound ends and
 * cuts it off with no room for the natural decay a longer phrase gets for
 * free — most noticeable on a single hanzi or syllable. A trailing Chinese
 * comma is a silent prosodic pause to the engine (never itself pronounced
 * as a word), just padding to speak past. Skipped when the text already
 * ends in punctuation, since that already provides the same pause and a
 * second one would be spoken as its own mark (e.g. "？，" reads as two
 * separate punctuation cues instead of one "？").
 */
function padTrailing(text: string): string {
  const chars = Array.from(text);
  const last = chars[chars.length - 1];
  if (last !== undefined && isPunctuationChar(last)) return text;
  return `${text}，`;
}

export function speak(text: string, lang = "zh-CN", rate = 1) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(padTrailing(text));
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
  const utterance = new SpeechSynthesisUtterance(padTrailing(first));
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
    const utterance = new SpeechSynthesisUtterance(padTrailing(texts[i]));
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
