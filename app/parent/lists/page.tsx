import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import ParentTabs from "../ParentTabs";
import ListsTable, { type ListRow } from "./ListsTable";

export default async function ListsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: children } = await supabase
    .from("children")
    .select("id, name")
    .order("created_at", { ascending: true });

  const childIds = (children ?? []).map((c) => c.id);
  const childNameById = new Map((children ?? []).map((c) => [c.id, c.name]));

  const { data: listsRaw } =
    childIds.length > 0
      ? await supabase
          .from("lists")
          .select(
            "id, child_id, name, test_date, status, best_pct, predicted_at_test, actual_score, actual_total, created_at"
          )
          .in("child_id", childIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  const lists: ListRow[] = (listsRaw ?? []).map((l) => ({
    id: l.id,
    childId: l.child_id,
    childName: childNameById.get(l.child_id) ?? "?",
    name: l.name,
    testDate: l.test_date,
    status: l.status,
    bestPct: l.best_pct,
    predictedAtTest: l.predicted_at_test,
    actualScore: l.actual_score,
    actualTotal: l.actual_total,
  }));

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Parent corner</h1>
        <ParentTabs active="Lists" />
        {lists.length === 0 ? (
          <p style={{ color: "var(--mut)" }}>No lists yet.</p>
        ) : (
          <ListsTable lists={lists} />
        )}
      </div>
    </main>
  );
}
