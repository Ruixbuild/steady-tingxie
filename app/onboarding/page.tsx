import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold text-center mb-1">
          Add your child
        </h1>
        <p className="text-center mb-6" style={{ color: "var(--mut)" }}>
          You can add more children later.
        </p>
        <OnboardingForm />
      </div>
    </main>
  );
}
