import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { suggestNextListName } from "@/lib/chineseNumerals";
import { ocrResultSchema } from "@/lib/ocrSchema";
import UploadFlow, { type ChildOption } from "./UploadFlow";
import ParentTabs from "../ParentTabs";

function mostCommonWeekdaySuggestion(testDates: string[]): string {
  if (testDates.length === 0) return "";
  const counts = new Array(7).fill(0);
  for (const d of testDates) counts[new Date(d).getUTCDay()]++;
  let bestDay = 0;
  for (let i = 1; i < 7; i++) if (counts[i] > counts[bestDay]) bestDay = i;

  const today = new Date();
  const todayDay = today.getUTCDay();
  let diff = (bestDay - todayDay + 7) % 7;
  if (diff === 0) diff = 7; // suggest next occurrence, not today
  const suggested = new Date(today.getTime() + diff * 86400000);
  return suggested.toISOString().slice(0, 10);
}

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ shared?: string; sharedError?: string }>;
}) {
  const { shared, sharedError } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let sharedSections: ReturnType<typeof ocrResultSchema.parse>["sections"] | null = null;
  if (shared) {
    try {
      sharedSections = ocrResultSchema.parse(JSON.parse(shared)).sections;
    } catch {
      sharedSections = null;
    }
  }

  const { data: children } = await supabase
    .from("children")
    .select("id, name, emoji")
    .order("created_at", { ascending: true });

  const childOptions: ChildOption[] = [];
  for (const child of children ?? []) {
    const { data: lists } = await supabase
      .from("lists")
      .select("name, test_date, created_at")
      .eq("child_id", child.id)
      .order("created_at", { ascending: false });

    const lastListName = lists?.[0]?.name ?? null;
    const testDates = (lists ?? []).map((l) => l.test_date).filter(Boolean) as string[];

    childOptions.push({
      id: child.id,
      name: child.name,
      emoji: child.emoji,
      suggestedListName: suggestNextListName(lastListName),
      suggestedTestDate: mostCommonWeekdaySuggestion(testDates),
    });
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl">
        <h1 className="text-2xl font-semibold mb-1">Upload a sheet</h1>
        <ParentTabs active="Upload" />
        <UploadFlow
          childOptions={childOptions}
          sharedSections={sharedSections}
          sharedError={sharedError === "1"}
        />
      </div>
    </main>
  );
}
