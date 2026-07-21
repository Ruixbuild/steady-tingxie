// Dev-only debug endpoint for the Seasonal Garden extension. Seeds/clears
// tree_growths rows for a child so the /garden scene can be exercised
// without waiting for real terms to pass. Returns 404 outside development
// so this never ships reachable in production.
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { termKey, previousTermKey, termBounds, gardenTier, type TreeType } from "@/lib/garden";
import type { SectionKind } from "@/lib/supabase/types";

function randomTimeWithin(start: Date, end: Date): string {
  const cappedEnd = Math.min(end.getTime(), Date.now());
  const lo = start.getTime();
  const hi = Math.max(lo, cappedEnd);
  return new Date(lo + Math.random() * (hi - lo)).toISOString();
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { childId } = (await request.json().catch(() => ({}))) as { childId?: string };
  if (!childId) {
    return NextResponse.json({ error: "Missing childId" }, { status: 400 });
  }

  const { data: child } = await supabase
    .from("children")
    .select("level")
    .eq("id", childId)
    .maybeSingle();
  if (!child) {
    return NextResponse.json({ error: "Child not found" }, { status: 400 });
  }

  const { data: listsRaw } = await supabase.from("lists").select("id").eq("child_id", childId);
  const listIds = (listsRaw ?? []).map((l) => l.id);
  if (listIds.length === 0) {
    return NextResponse.json({ error: "This child has no lists to seed from" }, { status: 400 });
  }

  const { data: sectionsRaw } = await supabase
    .from("sections")
    .select("kind, items(id, hanzi)")
    .in("list_id", listIds);
  const seedItems = ((sectionsRaw ?? []) as unknown as {
    kind: SectionKind;
    items: { id: string; hanzi: string }[] | null;
  }[]).flatMap((s) => (s.items ?? []).map((it) => ({ id: it.id, kind: s.kind, hanzi: it.hanzi })));
  if (seedItems.length === 0) {
    return NextResponse.json({ error: "This child's lists have no items to seed from" }, { status: 400 });
  }

  // Current term + 2 previous terms, so the term switcher and cross-term
  // regrowth (same word, two terms) are both visible in the seeded data.
  const currentKey = termKey(new Date());
  const keys = [currentKey, previousTermKey(currentKey), previousTermKey(previousTermKey(currentKey))];

  const rows: {
    child_id: string;
    item_id: string;
    term_key: string;
    tree_type: TreeType;
    grown_at: string;
  }[] = [];

  for (const key of keys) {
    const { start, end } = termBounds(key);
    const shuffled = [...seedItems].sort(() => Math.random() - 0.5);
    const pick = shuffled.slice(0, Math.min(shuffled.length, 5 + Math.floor(Math.random() * 4)));
    for (const item of pick) {
      rows.push({
        child_id: childId,
        item_id: item.id,
        term_key: key,
        tree_type: gardenTier(child.level, item.kind, item.hanzi),
        grown_at: randomTimeWithin(start, end),
      });
    }
  }

  const { error } = await supabase
    .from("tree_growths")
    .upsert(rows, { onConflict: "child_id,item_id,term_key", ignoreDuplicates: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ seeded: rows.length });
}

export async function DELETE(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { childId } = (await request.json().catch(() => ({}))) as { childId?: string };
  if (!childId) {
    return NextResponse.json({ error: "Missing childId" }, { status: 400 });
  }

  const { error } = await supabase.from("tree_growths").delete().eq("child_id", childId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
