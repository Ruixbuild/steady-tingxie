import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  SEASON_BACKDROP,
  SEASON_NAME,
  termKey as computeTermKey,
  termNumberFromKey,
} from "@/lib/garden";
import GardenScene, { type GardenTreeItem } from "./GardenScene";
import DebugSeedControls from "./DebugSeedControls";

type GrowthRow = {
  id: string;
  item_id: string;
  term_key: string;
  tree_type: "tree" | "fruit";
  grown_at: string;
  items: { hanzi: string } | null;
};

export default async function GardenPage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ term?: string }>;
}) {
  const { childId } = await params;
  const { term: requestedTerm } = await searchParams;

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

  const { data: growthsRaw } = await supabase
    .from("tree_growths")
    .select("id, item_id, term_key, tree_type, grown_at, items(hanzi)")
    .eq("child_id", childId)
    .order("grown_at", { ascending: true });

  const growths = (growthsRaw ?? []) as unknown as GrowthRow[];

  const countByTerm = new Map<string, number>();
  for (const g of growths) {
    countByTerm.set(g.term_key, (countByTerm.get(g.term_key) ?? 0) + 1);
  }
  const termPills = Array.from(countByTerm.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => ({ key, count }));

  const defaultTerm = computeTermKey(new Date());
  const activeTerm =
    requestedTerm && countByTerm.has(requestedTerm) ? requestedTerm : defaultTerm;

  const activeItems: GardenTreeItem[] = growths
    .filter((g) => g.term_key === activeTerm)
    .map((g) => ({
      id: g.id,
      itemId: g.item_id,
      hanzi: g.items?.hanzi ?? "",
      type: g.tree_type,
      grownAt: g.grown_at,
    }));

  const backdrop = SEASON_BACKDROP[termNumberFromKey(activeTerm)];
  const activeCount = activeItems.length;
  const lifetimeCount = growths.length;
  const termsGrown = countByTerm.size;

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl">
        <Link
          href={`/kid/${childId}`}
          className="mb-4 inline-block"
          style={{ color: "var(--accent)", fontWeight: 700 }}
        >
          ← Back
        </Link>

        <h1 className="text-2xl font-semibold mb-1">{child.name}&apos;s garden</h1>
        <p className="text-sm mb-4" style={{ color: "var(--mut)" }}>
          Term {termNumberFromKey(activeTerm)} · {SEASON_NAME[termNumberFromKey(activeTerm)]} garden
        </p>

        {process.env.NODE_ENV !== "production" && <DebugSeedControls childId={childId} />}

        {termPills.length > 1 && (
          <div className="flex gap-2 overflow-x-auto mb-4 pb-1">
            {termPills.map((pill) => {
              const active = pill.key === activeTerm;
              return (
                <Link
                  key={pill.key}
                  href={`/kid/${childId}/garden?term=${pill.key}`}
                  className="chip whitespace-nowrap"
                  style={
                    active
                      ? {
                          border: "2px solid var(--accent)",
                          background: "var(--accent-soft)",
                          color: "var(--accent-d)",
                        }
                      : { border: "1px solid var(--line)", background: "#fff", color: "var(--mut)" }
                  }
                >
                  Term {termNumberFromKey(pill.key)} · {pill.count}
                </Link>
              );
            })}
          </div>
        )}

        <GardenScene termKey={activeTerm} backdrop={backdrop} items={activeItems} />

        {activeItems.length === 0 && (
          <p className="mt-4 text-sm text-center" style={{ color: "var(--mut)" }}>
            No trees grown this term yet — keep practising to plant your first one 🌱
          </p>
        )}

        <div className="flex gap-3 mt-6">
          <div className="card p-4 flex-1 text-center">
            <p className="text-xl font-semibold">{lifetimeCount}</p>
            <p className="text-xs" style={{ color: "var(--mut)" }}>
              Lifetime tree/fruits
            </p>
          </div>
          <div className="card p-4 flex-1 text-center">
            <p className="text-xl font-semibold">{termsGrown}</p>
            <p className="text-xs" style={{ color: "var(--mut)" }}>
              Terms grown
            </p>
          </div>
          <div className="card p-4 flex-1 text-center">
            <p className="text-xl font-semibold">{activeCount}</p>
            <p className="text-xs" style={{ color: "var(--mut)" }}>
              This term
            </p>
          </div>
        </div>

        <p className="mt-3 text-xs text-center" style={{ color: "var(--mut)" }}>
          🌳 Pass a test on pinyin/short phrase to grow a tree · 🍎 Pass a test on
          long phrases/默写 to grow a fruit. Click on them to find out which seed
          grew them.
        </p>
      </div>
    </main>
  );
}
