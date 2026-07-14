import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { SectionKind } from "@/lib/supabase/types";
import { isTricky } from "@/lib/testScoring";
import { daysUntil } from "@/lib/dates";

type SectionRaw = {
  kind: SectionKind;
  items: { id: string; hanzi: string }[] | null;
};

async function buildChildLine(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  child: { id: string; name: string }
): Promise<string> {
  const { data: activeListsRaw } = await admin
    .from("lists")
    .select("id, test_date")
    .eq("child_id", child.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);
  const activeList = activeListsRaw?.[0] ?? null;

  const { count: sessionsThisWeek } = await admin
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("child_id", child.id)
    .gte("started_at", new Date(Date.now() - 7 * 86400000).toISOString());

  if (!sessionsThisWeek) {
    return `${child.name} hasn't practised this week`;
  }

  if (!activeList) {
    return `${child.name}: no active list right now`;
  }

  const { data: sectionsRaw } = await admin
    .from("sections")
    .select("kind, items(id, hanzi)")
    .eq("list_id", activeList.id);
  const sections = sectionsRaw as unknown as SectionRaw[];

  const nonPassageItemIds: string[] = [];
  for (const s of sections ?? []) {
    if (s.kind === "passage") continue;
    for (const it of s.items ?? []) nonPassageItemIds.push(it.id);
  }

  const { data: masteryRows } =
    nonPassageItemIds.length > 0
      ? await admin
          .from("mastery")
          .select("item_id, level, misses")
          .eq("child_id", child.id)
          .in("item_id", nonPassageItemIds)
      : { data: [] };
  const masteryByItem = new Map((masteryRows ?? []).map((m) => [m.item_id, m]));

  let masteredCount = 0;
  const tricky: { hanzi: string; level: number; misses: number }[] = [];
  for (const s of sections ?? []) {
    if (s.kind === "passage") continue;
    for (const it of s.items ?? []) {
      const m = masteryByItem.get(it.id);
      const level = m?.level ?? 0;
      const misses = m?.misses ?? 0;
      if (level >= 2) masteredCount++;
      if (isTricky(s.kind, level, misses)) tricky.push({ hanzi: it.hanzi, level, misses });
    }
  }
  tricky.sort((a, b) => b.misses - a.misses || a.level - b.level);
  const worst = tricky[0]?.hanzi ?? null;

  const d = activeList.test_date ? daysUntil(activeList.test_date) : null;

  const parts = [`${child.name}: ${masteredCount} words mastered`];
  if (worst) parts.push(`${worst} still shaky`);
  if (d !== null) parts.push(`test in ${d} day${d === 1 ? "" : "s"}`);
  return parts.join(", ");
}

async function sendDigestEmail(to: string, lines: string[]): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const body = lines.join("\n");

  if (!apiKey) {
    console.log(`[digest] (dry run, no RESEND_API_KEY) would send to ${to}:\n${body}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Steady Ting Xie <digest@steadytingxie.app>",
      to,
      subject: "Your weekly Ting Xie digest",
      text: body,
    }),
  });

  if (!res.ok) {
    console.error(`[digest] Resend API error for ${to}: ${res.status} ${await res.text()}`);
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminSupabaseClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("digest_email", true);

  const results: { parentId: string; lines: string[] }[] = [];

  for (const profile of profiles ?? []) {
    const { data: children } = await admin
      .from("children")
      .select("id, name")
      .eq("parent_id", profile.id);

    if (!children || children.length === 0) continue;

    const lines: string[] = [];
    for (const child of children) {
      lines.push(await buildChildLine(admin, child));
    }
    results.push({ parentId: profile.id, lines });

    const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
    const email = authUser?.user?.email;
    if (email) {
      await sendDigestEmail(email, lines);
    } else {
      console.log(`[digest] no email on file for parent ${profile.id}, skipping send`);
    }
  }

  return NextResponse.json({
    sent: results.length,
    dryRun: !process.env.RESEND_API_KEY,
    results,
  });
}
