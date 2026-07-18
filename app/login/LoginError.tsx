"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginError() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const err = searchParams.get("error");
    if (err) {
      setError(decodeURIComponent(err));
    }
  }, [searchParams]);

  if (!error) return null;

  return (
    <p className="text-sm text-center" style={{ color: "var(--miss)" }}>
      {error}
    </p>
  );
}
