import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function ChooseModulePage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: child } = await supabase
    .from("children")
    .select("id, name, emoji")
    .eq("id", childId)
    .maybeSingle();
  if (!child) notFound();

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl flex flex-col gap-4">
        <Link href="/" className="inline-block text-base" style={{ color: "var(--accent)", fontWeight: 700 }}>
          ← Switch profile
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-4xl">{child.emoji}</span>
          <h1 className="text-2xl font-semibold">{child.name}</h1>
        </div>
        <p style={{ color: "var(--mut)" }}>What would you like to practise today?</p>

        <Link href={`/kid/${childId}`} className="card p-5 flex flex-col gap-1">
          <span className="font-semibold">✍️ 听写</span>
          <span className="text-sm" style={{ color: "var(--mut)" }}>
            Pinyin, stroke drills, spelling and dictation tests
          </span>
        </Link>

        <Link href={`/kid/${childId}/vocab`} className="card p-5 flex flex-col gap-1">
          <span className="font-semibold">📖 Vocabulary Revision</span>
          <span className="text-sm" style={{ color: "var(--mut)" }}>
            Coming soon
          </span>
        </Link>
      </div>
    </main>
  );
}
