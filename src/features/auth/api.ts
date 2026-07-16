import { ensureUserProfile } from "@/features/auth/profile-recovery";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getApiUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  try {
    return await ensureUserProfile(data.user);
  } catch {
    await supabase.auth.signOut();
    return null;
  }
}
