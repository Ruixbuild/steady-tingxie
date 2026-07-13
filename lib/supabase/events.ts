import { createAdminSupabaseClient } from "./admin";

function startOfTodaySGT(): Date {
  const now = new Date();
  const sgtShifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const y = sgtShifted.getUTCFullYear();
  const m = sgtShifted.getUTCMonth();
  const d = sgtShifted.getUTCDate();
  const midnightSgtInUtcMs = Date.UTC(y, m, d, 0, 0, 0) - 8 * 60 * 60 * 1000;
  return new Date(midnightSgtInUtcMs);
}

// Runs right after a magic-link session is established. Ensures the
// profiles row + one-time signup event exist, records at most one
// login event per SGT calendar day, and reports whether onboarding
// (adding a first child) is still needed.
export async function ensureProfileAndDailyEvents(
  userId: string
): Promise<{ needsOnboarding: boolean }> {
  const admin = createAdminSupabaseClient();

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!existingProfile) {
    await admin.from("profiles").insert({ id: userId });
    await admin.from("events").insert({ user_id: userId, event: "signup" });
  }

  const { data: todaysLogin } = await admin
    .from("events")
    .select("id")
    .eq("user_id", userId)
    .eq("event", "login")
    .gte("ts", startOfTodaySGT().toISOString())
    .limit(1)
    .maybeSingle();

  if (!todaysLogin) {
    await admin.from("events").insert({ user_id: userId, event: "login" });
  }

  const { count } = await admin
    .from("children")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", userId);

  return { needsOnboarding: !count };
}
