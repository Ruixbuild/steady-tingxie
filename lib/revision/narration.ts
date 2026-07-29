// Revision's own narration mechanism — calls /api/tts directly instead of
// going through lib/tts.ts's speak()/speakPaced(). Since this bypasses
// lib/tts.ts's playOne() entirely, its namePunctuation() step (which spells
// full-width Chinese marks out by name, ，-> "逗号" — necessary for TingXie's
// dictation tests, wrong for Revision's plain-reading sentences) never runs
// on anything sent from here, regardless of what punctuation the text
// contains. So there's no need to strip or substitute punctuation at all —
// the original full-width marks are sent to Google's Mandarin voice exactly
// as written, letting it produce natural pacing/pauses the way it would for
// any real Chinese sentence.
//
// An earlier version of this file instead split text into multiple
// segments at each pause mark and played them as separate clips with a
// real timed gap in between (mirroring lib/tts.ts's own speakPaced(), which
// creates pauses that way rather than trusting the engine to read a comma
// as one) — but each additional segment is its own new Audio().play() call,
// further removed in time from the tap that started narration, and browsers
// inconsistently block that once enough delay/async hops have accumulated
// (the same class of issue that broke word-to-word auto-play in the Test
// feature). One single clip per call sidesteps that fragility completely.

// One persistent <audio> element, reused for every call, rather than a
// fresh `new Audio()` each time. Browsers are markedly more willing to let
// play() proceed on an element that has already successfully played once
// as a direct result of a user gesture — even from a later timer/effect
// callback with no fresh gesture of its own — than they are for a
// brand-new element created at that later point. Reusing one element is
// what makes word-to-word auto-play in the Test feature hold up instead of
// only ever working for the very first, gesture-adjacent word.
let audioEl: HTMLAudioElement | null = null;
function getAudioEl(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audioEl) audioEl = new Audio();
  return audioEl;
}

const audioCache = new Map<string, Promise<string>>();

const REVISION_RATE = 0.8;

async function fetchClip(text: string): Promise<string> {
  const key = `${REVISION_RATE}|${text}`;
  const cached = audioCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang: "zh-CN", rate: REVISION_RATE }),
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
  if (audioEl) {
    audioEl.onerror = null;
    audioEl.pause();
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function fallbackSpeak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = REVISION_RATE;
  // Chrome can silently drop a speak() issued in the same tick as cancel().
  setTimeout(() => {
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  }, 0);
}

/** Revision's one narration entry point — one clip per call, real Chinese
 * punctuation left intact for Google's own natural phrasing, played on a
 * single reused <audio> element (see getAudioEl above). */
export function speakRevision(text: string): void {
  stopCurrent();
  fetchClip(text)
    .then((url) => {
      const audio = getAudioEl();
      if (!audio) return;
      audio.onerror = () => fallbackSpeak(text);
      // "Say it again"/replaying the same word reuses this element's
      // current src verbatim -- reassigning `.src` to an identical blob:
      // URL still makes the browser reload/re-buffer it, producing a
      // brief silent gap before playback actually starts. Skipping the
      // reassignment when it's already the right clip removes that gap;
      // rewinding via currentTime is enough to replay from the start.
      if (audio.src === url) {
        audio.currentTime = 0;
      } else {
        audio.src = url;
      }
      audio.play().catch(() => fallbackSpeak(text));
    })
    .catch(() => fallbackSpeak(text));
}

// Removal of quote marks and stroke-quiz-irrelevant punctuation for the
// short vocab words passed to CharLadder/StrokeLadder's word/announceWord
// props — those are single ci yu, not sentences, so there's no pause
// structure to preserve in the first place.
const STRIP_RE = /[，。！？；、“”「」]/g;

export function stripPunctuation(text: string): string {
  return text.replace(STRIP_RE, "");
}
