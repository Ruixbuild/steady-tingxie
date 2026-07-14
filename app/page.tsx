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
      <SettingsGear />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon-512.png"
        alt="Steady Ting Xie"
        width={60}
        height={60}
        className="rounded-full mb-8"
        style={{ boxShadow: "0 8px 24px rgba(44,130,201,.18)" }}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-2xl">
        {children.map((child) => (
          <Link
            key={child.id}
            href={`/kid/${child.id}`}
            className="card flex flex-col items-center gap-2 p-6"
          >
            <span className="text-4xl">{child.emoji}</span>
            <span className="font-semibold">{child.name}</span>
            <span className="text-sm" style={{ color: "var(--mut)" }}>
              {child.level}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
