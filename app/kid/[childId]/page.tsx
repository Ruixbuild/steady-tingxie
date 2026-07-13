import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function ChildHomePage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: child } = await supabase
    .from("children")
    .select("id, name, level, emoji")
    .eq("id", childId)
    .maybeSingle();

  if (!child) {
    notFound();
  }

  const { data: lists } = await supabase
    .from("lists")
    .select("id, name, test_date, status")
    .eq("child_id", childId)
    .order("created_at", { ascending: false });

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-4xl">{child.emoji}</span>
          <div>
            <h1 className="text-2xl font-semibold">{child.name}</h1>
            <p style={{ color: "var(--mut)" }}>{child.level}</p>
          </div>
        </div>

        <Link href={`/kid/${childId}/new-list`} className="btn btn-primary mb-6 inline-flex">
          + New list
        </Link>

        <div className="flex flex-col gap-3">
          {(!lists || lists.length === 0) && (
            <p style={{ color: "var(--mut)" }}>No lists yet — create one to get started.</p>
          )}
          {lists?.map((list) => (
            <Link
              key={list.id}
              href={`/kid/${childId}/list/${list.id}`}
              className="card flex items-center justify-between p-5"
            >
              <span className="font-semibold">{list.name}</span>
              <span className="text-sm" style={{ color: "var(--mut)" }}>
                {list.test_date ?? list.status}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
