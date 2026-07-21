import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSystemAdministrator } from "@/features/admin/access";
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

export async function requireSystemAdministrator() {
  const user = await requireAuthenticatedUser();
  if (!isSystemAdministrator(user)) notFound();
  return user;
}
