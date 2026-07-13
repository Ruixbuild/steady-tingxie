"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

const HOLD_MS = 1200;

export default function SettingsGear() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    timerRef.current = setTimeout(() => {
      router.push("/parent");
    }, HOLD_MS);
  }, [router]);

  const cancel = useCallback(() => {
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
      className="fixed top-5 right-5 flex items-center justify-center rounded-full"
      style={{
        width: 44,
        height: 44,
        background: "#fff",
        border: "1px solid var(--line)",
        color: "var(--mut)",
        fontSize: "1.2rem",
        boxShadow: "0 2px 8px rgba(29,42,51,.05)",
      }}
    >
      ⚙
    </button>
  );
}
