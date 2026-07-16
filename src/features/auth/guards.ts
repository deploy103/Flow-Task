import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({ where: { id: data.user.id } });
  if (!user) {
    redirect("/login?error=profile_missing");
  }

  return user;
}
