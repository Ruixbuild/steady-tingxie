import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Stub for Phase 1 (schema + landing only) — replaced with the real zoo
// scene in a later phase.
export default async function VocabProgressStubPage({
  params,
}: {
  params: Promise<{ childId: string; chapterNumber: string }>;
}) {
  const { childId, chapterNumber } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: child } = await supabase
    .from("children")
    .select("id, name")
    .eq("id", childId)
    .maybeSingle();
  if (!child) notFound();

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl flex flex-col gap-4">
        <Link
          href={`/kid/${childId}/vocab/${chapterNumber}`}
          className="inline-block text-base"
          style={{ color: "var(--accent)", fontWeight: 700 }}
        >
          ← Back
        </Link>

        <div className="card p-8 flex flex-col items-center text-center gap-3">
          <span className="text-5xl">🦁</span>
          <h1 className="text-2xl font-semibold">Progress</h1>
          <p style={{ color: "var(--mut)" }}>
            {child.name}, the vocab zoo is coming soon — check back later!
          </p>
        </div>
      </div>
    </main>
  );
}
