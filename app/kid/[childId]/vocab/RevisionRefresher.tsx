"use client";

// Forces a fresh server refetch of the page it's rendered on, once, right
// after mount, AND whenever the browser restores this page from its native
// back/forward cache (bfcache). Next.js's own Client Router Cache doesn't
// reuse page segments on a plain forward <Link> navigation by default --
// but it explicitly still does on browser back/forward navigation (a
// swipe-back gesture or the back button), which is unaffected by the
// staleTimes config. That mismatch is what "mastery doesn't update until
// you click into a card again" turned out to be: a genuinely new route (a
// specific word's page, never visited yet this session) always fetches
// fresh, masking that a revisited route reached via back/forward can still
// show a snapshot from before a Test run updated revision_mastery.
//
// The mount effect alone isn't enough on iPad/Safari, though: a swipe-back
// gesture there commonly triggers the browser's *native* bfcache restore --
// a lower layer than Next's router, which resurrects the whole page
// (DOM, JS state, everything) without any new navigation, mount, or render
// happening at all, so a plain `useEffect(..., [])` never re-fires for it.
// The `pageshow` event's `persisted` flag is the one reliable signal for
// that case, so it's handled here too.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RevisionRefresher() {
  const router = useRouter();
  useEffect(() => {
    router.refresh();

    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) router.refresh();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
