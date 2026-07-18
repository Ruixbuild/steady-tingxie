// Thin wrapper over the Web Speech API for the Learn set-complete "太棒了" cue.

// Chrome garbage-collects a SpeechSynthesisUtterance that has no surviving
// reference, which cuts audio off mid-word. Keeping the latest one alive
// here prevents that.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speak(text: string, lang = "zh-CN") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

/** Speaks each string in order, only starting the next once the previous
 * utterance finishes — e.g. announcing a whole test word before the
 * specific character being tested. */
export function speakSequence(texts: string[], lang = "zh-CN") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const [first, ...rest] = texts;
  if (first === undefined) return;
  const utterance = new SpeechSynthesisUtterance(first);
  utterance.lang = lang;
  if (rest.length > 0) {
    utterance.onend = () => speakSequence(rest, lang);
  }
  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}
