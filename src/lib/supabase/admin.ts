import { createClient } from "@supabase/supabase-js";
import { getStorageEnvironment } from "@/lib/env";

export function createSupabaseAdminClient() {
  const environment = getStorageEnvironment();
  return createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
