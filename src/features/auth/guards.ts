import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "./profile-recovery";

export async function requireAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  try {
    return await ensureUserProfile(data.user);
  } catch {
    await supabase.auth.signOut();
    redirect("/login?error=profile_recovery_failed");
  }
}
