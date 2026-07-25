import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import ParentTabs from "../ParentTabs";

export default async function SupportPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl flex flex-col gap-6">
        <Link href="/" className="inline-block text-base" style={{ color: "var(--accent)", fontWeight: 700 }}>
          ← Exit parent corner
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">⚙ Parent corner</h1>
          <Link href="/onboarding" className="btn btn-sm btn-secondary">
            + Add child
          </Link>
        </div>
        <ParentTabs active="Support" />
        <div className="card p-5">
          <p>
            If you have any feedback or support you require, please email{" "}
            <a href="mailto:placeholder@x.com" style={{ color: "var(--accent)", fontWeight: 700 }}>
              placeholder@x.com
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
