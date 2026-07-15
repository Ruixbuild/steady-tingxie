"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(
        error.status && error.status >= 500
          ? "Couldn't send the email — the mail server rejected it. Check your Supabase SMTP settings."
          : error.message
      );
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="card w-full max-w-sm p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-512.png"
          alt="Steady Ting Xie"
          width={280}
          height={280}
          className="rounded-full mx-auto mb-4 block"
          style={{ boxShadow: "0 8px 24px rgba(44,130,201,.18)" }}
        />
        <h1 className="text-2xl font-semibold text-center mb-1">
          Steady Ting Xie
        </h1>
        <p className="text-center mb-6" style={{ color: "var(--mut)" }}>
          {"听写"} revision for your child
        </p>

        {status === "sent" ? (
          <p className="text-center" style={{ color: "var(--ink)" }}>
            Check <strong>{email}</strong> for your sign-in link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-full border px-5 py-3 outline-none"
              style={{
                borderColor: "var(--line)",
                color: "var(--ink)",
              }}
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="btn btn-primary w-full"
            >
              {status === "sending" ? "Sending…" : "Send me a link"}
            </button>
            {status === "error" && (
              <p className="text-sm text-center" style={{ color: "var(--miss)" }}>
                {errorMessage}
              </p>
            )}
          </form>
        )}

        <p
          className="text-xs text-center mt-6"
          style={{ color: "var(--mut)" }}
        >
          Your child&apos;s name and progress are stored securely to power
          their revision — never shared.
        </p>
      </div>
    </main>
  );
}
