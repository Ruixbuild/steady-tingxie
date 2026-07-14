"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const HOLD_MS = 1200;

export default function SettingsGear() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);

  const start = useCallback(() => {
    setHolding(true);
    timerRef.current = setTimeout(() => {
      router.push("/parent");
    }, HOLD_MS);
  }, [router]);

  const cancel = useCallback(() => {
    setHolding(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return (
    <button
      type="button"
      aria-label="Parent settings (press and hold)"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      className="btn btn-secondary"
      style={{ position: "relative", overflow: "hidden" }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: holding ? "100%" : "0%",
          background: "rgba(159,184,200,.4)",
          transition: holding ? `width ${HOLD_MS}ms linear` : "none",
        }}
      />
      <span style={{ position: "relative" }}>⚙ Parents — press &amp; hold</span>
    </button>
  );
}
