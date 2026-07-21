"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DebugSeedControls({ childId }: { childId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function seed() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/garden/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId }),
      });
      const body = await res.json();
      setMessage(res.ok ? `Seeded ${body.seeded} trees` : body.error ?? "Seed failed");
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/garden/seed", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId }),
      });
      const body = await res.json();
      setMessage(res.ok ? "Cleared" : body.error ?? "Clear failed");
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 mb-4 text-sm">
      <span className="chip" style={{ background: "var(--warn-soft)", color: "#8A6200" }}>
        DEV
      </span>
      <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={seed}>
        🌱 Seed test data
      </button>
      <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={clear}>
        🗑️ Clear
      </button>
      {message && <span style={{ color: "var(--mut)" }}>{message}</span>}
    </div>
  );
}
