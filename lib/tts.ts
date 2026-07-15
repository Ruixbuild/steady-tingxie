// Thin wrapper over the Web Speech API for the Learn set-complete "太棒了" cue.

export function speak(text: string, lang = "zh-CN") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
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
  window.speechSynthesis.speak(utterance);
}
