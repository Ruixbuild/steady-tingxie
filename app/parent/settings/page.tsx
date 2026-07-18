import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import ParentTabs from "../ParentTabs";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: children } = await supabase
    .from("children")
    .select("id, name, level, hard_mode")
    .order("created_at", { ascending: true });

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl flex flex-col gap-6">
        <Link href="/" className="inline-block" style={{ color: "var(--accent)", fontWeight: 700 }}>
          ← Exit parent corner
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">⚙ Parent corner</h1>
          <Link href="/onboarding" className="btn btn-sm btn-secondary">
            + Add child
          </Link>
        </div>
        <ParentTabs active="Settings" />
        <SettingsForm
          childOptions={(children ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            level: c.level,
            hardMode: c.hard_mode,
          }))}
        />
      </div>
    </main>
  );
}
