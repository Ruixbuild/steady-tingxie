import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import NewListForm from "./NewListForm";

export default async function NewListPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: child } = await supabase
    .from("children")
    .select("id, name")
    .eq("id", childId)
    .maybeSingle();

  if (!child) {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl">
        <h1 className="text-2xl font-semibold mb-6">New list for {child.name}</h1>
        <NewListForm childId={childId} />
      </div>
    </main>
  );
}
