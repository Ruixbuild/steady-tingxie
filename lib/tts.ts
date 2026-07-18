// Thin wrapper over the Web Speech API for the Learn set-complete "太棒了" cue.

// Chrome garbage-collects a SpeechSynthesisUtterance that has no surviving
// reference, which cuts audio off mid-word. Keeping the latest one alive
// here prevents that.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speak(text: string, lang = "zh-CN", rate = 1) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
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

/** Speaks each string in order, only starting the next once the previous
 * utterance finishes — e.g. announcing a whole test word before the
 * specific character being tested. */
export function speakSequence(texts: string[], lang = "zh-CN", rate = 1) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const [first, ...rest] = texts;
  if (first === undefined) return;
  const utterance = new SpeechSynthesisUtterance(first);
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
