import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="card w-full max-w-md p-8">
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
                Signups
              </td>
              <td className="py-2 font-semibold">{signupCount ?? 0}</td>
            </tr>
            <tr>
              <td className="py-2" style={{ color: "var(--mut)" }}>
                Logins
              </td>
              <td className="py-2 font-semibold">{loginCount ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
