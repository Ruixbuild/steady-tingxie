import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureProfileAndDailyEvents } from "@/lib/supabase/events";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const { needsOnboarding } = await ensureProfileAndDailyEvents(
        data.user.id
      );
      return NextResponse.redirect(
        `${origin}${needsOnboarding ? "/onboarding" : "/"}`
      );
    }

    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`
      );
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Invalid+link`);
}
