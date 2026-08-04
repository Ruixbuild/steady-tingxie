"use client";

import { useEffect } from "react";

// iOS WebKit (Safari, and every other iOS browser — Apple requires them all
// to use WebKit under the hood, including "Chrome" on iPhone) only allows an
// <audio> element to play() if that call happens synchronously inside a user
// gesture handler. lib/tts.ts's auto-announce-on-arrival plays from a
// useEffect after a client-side navigation (e.g. tapping the child home CTA
// -> router.push into Learn) — by the time that effect's play() call fires,
// it's no longer "inside" the tap that triggered the navigation, so iOS
// silently blocks it. Manually tapping "Say it again" still works fine,
// since that IS a direct click handler calling play().
//
// The standard fix: play (and immediately stop) a real, valid <audio>
// element synchronously on the very first tap/click anywhere in the page.
// WebKit then treats the page as unlocked for the rest of the session, so
// later programmatic play() calls on newly-created <audio> elements (like
// lib/tts.ts's playOne()) succeed without needing their own direct gesture.
//
// A minimal, silent, valid WAV (8kHz, 8-bit, 8 samples) — small enough to
// inline, and calling play() on it is what actually registers the unlock;
// its content never needs to be audible.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICAgA==";

export default function AudioUnlock() {
  useEffect(() => {
    let unlocked = false;

    function unlock() {
      if (unlocked) return;
      unlocked = true;
      const audio = new Audio(SILENT_WAV);
      audio.play().then(
        () => audio.pause(),
        () => {}
      );
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    }

    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("touchstart", unlock, { once: true });
    document.addEventListener("click", unlock, { once: true });

    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };
  }, []);

  return null;
}
