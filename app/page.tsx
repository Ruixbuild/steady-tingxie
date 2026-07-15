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
    .select("id, name, level, emoji")
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

      <h1 className="text-center mt-2">Who&apos;s practising today?</h1>

      <div
        className="w-full max-w-2xl gap-4 mt-6"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}
      >
        {children.map((child) => (
          <Link
            key={child.id}
            href={`/kid/${child.id}`}
            className="flex flex-col items-center text-center"
            style={{
              background: "#fff",
              border: "1.5px solid var(--line)",
              borderRadius: 24,
              padding: "10px 16px",
            }}
          >
            <span style={{ fontSize: "2rem" }}>{child.emoji}</span>
            <span style={{ fontSize: "1.25rem", fontWeight: 800, marginTop: 2 }}>{child.name}</span>
            <span className="text-sm" style={{ color: "var(--mut)" }}>
              {child.level}
            </span>
          </Link>
        ))}
      </div>

      <Link href="/onboarding" className="btn btn-sm btn-secondary mt-6">
        + Add child
      </Link>

      <div className="mt-8">
        <SettingsGear />
      </div>
    </main>
  );
}
