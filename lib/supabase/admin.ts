import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Service-role client. Bypasses RLS — server-only, never import from
// client components. Used where no RLS policy grants the needed access
// (e.g. reading `events`, which has insert-only RLS) or for trusted
// server-side bookkeeping right after a magic-link session is created.
export function createAdminSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
