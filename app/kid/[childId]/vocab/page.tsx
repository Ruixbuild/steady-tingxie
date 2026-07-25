import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function VocabRevisionPlaceholderPage({
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
        <Link
          href={`/kid/${childId}/choose`}
          className="inline-block text-base"
          style={{ color: "var(--accent)", fontWeight: 700 }}
        >
          ← Back
        </Link>

        <div className="card p-8 flex flex-col items-center text-center gap-3">
          <span className="text-5xl">📖</span>
          <h1 className="text-2xl font-semibold">Vocabulary Revision</h1>
          <p style={{ color: "var(--mut)" }}>
            {child.name}, this module is coming soon — check back later!
          </p>
        </div>
      </div>
    </main>
  );
}
