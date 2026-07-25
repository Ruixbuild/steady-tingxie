import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import SettingsGear from "./SettingsGear";

export default async function ProfilePickerPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: children } = await supabase
    .from("children")
    .select("id, name, emoji")
    .order("created_at", { ascending: true });

  if (!children || children.length === 0) {
    redirect("/onboarding");
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon-512.png"
        alt="Steady Ting Xie"
        width={150}
        height={150}
        className="rounded-full mb-2"
        style={{ boxShadow: "0 8px 24px rgba(44,130,201,.18)" }}
      />

      <h1 className="text-center mt-2" style={{ fontSize: "1.5rem", fontWeight: 800 }}>
        Who&apos;s learning today?
      </h1>

      <div
        className="w-full max-w-2xl gap-4 mt-6"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}
      >
        {children.map((child) => (
          <Link
            key={child.id}
            href={`/kid/${child.id}/choose`}
            className="flex items-center justify-center gap-2"
            style={{
              background: "#fff",
              border: "1.5px solid var(--line)",
              borderRadius: 20,
              padding: "14px 18px",
            }}
          >
            <span style={{ fontSize: "1.75rem" }}>{child.emoji}</span>
            <span style={{ fontSize: "1.15rem", fontWeight: 800 }}>{child.name}</span>
          </Link>
        ))}
      </div>

      <Link href="/onboarding" className="btn btn-sm btn-secondary mt-6">
        + Add child
      </Link>

      <div className="mt-8 flex flex-col items-center gap-2">
        <SettingsGear />
        <a
          href="https://alert-marquess-169.notion.site/Online-Safety-Tips-3a4efcd98b9c8063b5b3f1b3b52b7690"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 text-xs"
          style={{ color: "var(--ink)", opacity: 0.75, textDecoration: "underline" }}
        >
          Online Safety Tips
        </a>
      </div>
    </main>
  );
}
