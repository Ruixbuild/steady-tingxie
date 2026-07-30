"use client";

// Forces a fresh server refetch of the page it's rendered on, once, right
// after mount. Next.js's Client Router Cache doesn't reuse page segments
// on a plain forward <Link> navigation by default -- but it explicitly
// still does on browser back/forward navigation (a swipe-back gesture or
// the back button), which is unaffected by the staleTimes config. That
// mismatch is what "mastery doesn't update until you click into a card
// again" turned out to be: a genuinely new route (a specific word's page,
// never visited yet this session) always fetches fresh, masking that a
// revisited route reached via back/forward can still show a snapshot from
// before a Test run updated revision_mastery. Rendering this once per
// mastery-displaying page closes that gap regardless of how it was
// reached, at the cost of one extra fetch on a normal first visit.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RevisionRefresher() {
  const router = useRouter();
  useEffect(() => {
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
