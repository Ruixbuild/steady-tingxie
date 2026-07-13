// Thin wrapper over the Web Speech API for the Learn set-complete "太棒了" cue.

export function speak(text: string, lang = "zh-CN") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}
