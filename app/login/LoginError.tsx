"use client";

import { useSearchParams } from "next/navigation";

export default function LoginError() {
  const searchParams = useSearchParams();
  const err = searchParams.get("error");
  const error = err ? decodeURIComponent(err) : "";

  if (!error) return null;

  return (
    <p className="text-sm text-center" style={{ color: "var(--miss)" }}>
      {error}
    </p>
  );
}
