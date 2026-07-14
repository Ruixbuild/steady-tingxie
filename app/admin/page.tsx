import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import BarChart from "./BarChart";

const DAU_EVENTS = new Set(["login", "session", "test"]);

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!user?.email || !adminEmails.includes(user.email.toLowerCase())) {
    notFound();
  }

  const admin = createAdminSupabaseClient();

  const { count: signupCount } = await admin
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("event", "signup");

  const { count: loginCount } = await admin
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("event", "login");

  const { count: accountCount } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true });

  const { count: listCount } = await admin
    .from("lists")
    .select("id", { count: "exact", head: true });

  const { count: testCount } = await admin
    .from("attempts")
    .select("id", { count: "exact", head: true });

  const { count: sessionCount } = await admin
    .from("sessions")
    .select("id", { count: "exact", head: true });

  const today = new Date();
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(isoDate(d));
  }
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000).toISOString();

  const { data: recentEvents } = await admin
    .from("events")
    .select("user_id, event, ts")
    .gte("ts", thirtyDaysAgo);

  const signupsByDay = new Map(days.map((d) => [d, 0]));
  const dauSetByDay = new Map<string, Set<string>>(days.map((d) => [d, new Set<string>()]));

  for (const e of recentEvents ?? []) {
    const day = isoDate(new Date(e.ts));
    if (e.event === "signup" && signupsByDay.has(day)) {
      signupsByDay.set(day, (signupsByDay.get(day) ?? 0) + 1);
    }
    if (DAU_EVENTS.has(e.event) && e.user_id && dauSetByDay.has(day)) {
      dauSetByDay.get(day)!.add(e.user_id);
    }
  }

  const signupsChart = days.map((d) => ({ label: d, value: signupsByDay.get(d) ?? 0 }));
  const dauChart = days.map((d) => ({ label: d, value: dauSetByDay.get(d)?.size ?? 0 }));

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="card w-full max-w-2xl p-8 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold mb-6">Admin</h1>
          <table className="w-full text-left">
            <tbody>
              <tr>
                <td className="py-2" style={{ color: "var(--mut)" }}>
                  Total accounts
                </td>
                <td className="py-2 font-semibold">{accountCount ?? 0}</td>
              </tr>
              <tr>
                <td className="py-2" style={{ color: "var(--mut)" }}>
                  Signups (all time)
                </td>
                <td className="py-2 font-semibold">{signupCount ?? 0}</td>
              </tr>
              <tr>
                <td className="py-2" style={{ color: "var(--mut)" }}>
                  Logins (all time)
                </td>
                <td className="py-2 font-semibold">{loginCount ?? 0}</td>
              </tr>
              <tr>
                <td className="py-2" style={{ color: "var(--mut)" }}>
                  Lists created
                </td>
                <td className="py-2 font-semibold">{listCount ?? 0}</td>
              </tr>
              <tr>
                <td className="py-2" style={{ color: "var(--mut)" }}>
                  Tests taken
                </td>
                <td className="py-2 font-semibold">{testCount ?? 0}</td>
              </tr>
              <tr>
                <td className="py-2" style={{ color: "var(--mut)" }}>
                  Learn sessions
                </td>
                <td className="py-2 font-semibold">{sessionCount ?? 0}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <p className="font-semibold mb-2">Signups per day (last 30 days)</p>
          <BarChart data={signupsChart} />
        </div>

        <div>
          <p className="font-semibold mb-2">Daily active users (last 30 days)</p>
          <BarChart data={dauChart} />
        </div>
      </div>
    </main>
  );
}
