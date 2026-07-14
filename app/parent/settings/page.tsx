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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, digest_email")
    .eq("id", user.id)
    .maybeSingle();

  const { data: children } = await supabase
    .from("children")
    .select("id, name, level, hard_mode")
    .order("created_at", { ascending: true });

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Parent corner</h1>
        <ParentTabs active="Settings" />
        <SettingsForm
          digestEmail={profile?.digest_email ?? false}
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
