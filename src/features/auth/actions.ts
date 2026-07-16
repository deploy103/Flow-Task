"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getServerEnvironment } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginSchema, profileSchema, signUpSchema } from "./schemas";
import { requireAuthenticatedUser } from "./guards";

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/login?error=invalid_input");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/login?error=invalid_credentials");

  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/signup?error=invalid_input");

  const supabase = await createSupabaseServerClient();
  const { NEXT_PUBLIC_APP_URL } = getServerEnvironment();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
      emailRedirectTo: `${NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error || !data.user) redirect("/signup?error=signup_failed");

  try {
    await prisma.user.create({
      data: {
        id: data.user.id,
        email: parsed.data.email,
        name: parsed.data.name,
        studentNumber: parsed.data.studentNumber,
      },
    });
  } catch {
    redirect("/signup?error=profile_creation_failed");
  }

  redirect(data.session ? "/dashboard" : "/login?message=check_email");
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateProfile(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/profile?error=invalid_input");

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: parsed.data,
      }),
      prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "PROFILE_UPDATED",
          targetType: "USER",
          targetId: user.id,
        },
      }),
    ]);
  } catch {
    redirect("/profile?error=update_failed");
  }

  revalidatePath("/profile");
  redirect("/profile?message=updated");
}
