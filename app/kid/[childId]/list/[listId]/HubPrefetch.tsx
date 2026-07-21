"use client";

import { useEffect } from "react";
import { prefetchChars } from "@/lib/hanziCache";

// Invisible — warms the stroke-data cache while the child is still browsing
// the hub, so Learn/Test don't hit a cold CDN fetch on every new character.
export default function HubPrefetch({ chars }: { chars: string[] }) {
  useEffect(() => {
    prefetchChars(chars);
  }, [chars]);

  return null;
}
