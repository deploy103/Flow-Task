"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { loginSchema, profileSchema, signUpSchema } from "./schemas";
import { requireAuthenticatedUser } from "./guards";
import { hashPassword, verifyPassword } from "./password";
import { createUserSession, revokeCurrentSession } from "./session";
import { consumeAuthAttempt } from "./rate-limit";

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/login?error=invalid_input");
  if (!(await consumeAuthAttempt("LOGIN", parsed.data.email))) redirect("/login?error=rate_limited");

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: { credential: true },
  });
  if (!user?.credential) {
    await hashPassword(parsed.data.password);
    redirect("/login?error=invalid_credentials");
  }
  if (!(await verifyPassword(parsed.data.password, user.credential.passwordHash))) {
    redirect("/login?error=invalid_credentials");
  }
  await createUserSession(user.id);

  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/signup?error=invalid_input");
  if (!(await consumeAuthAttempt("SIGNUP", parsed.data.email))) redirect("/signup?error=rate_limited");

  const id = randomUUID();
  const email = parsed.data.email.toLowerCase();
  const passwordHash = await hashPassword(parsed.data.password);
  try {
    await prisma.user.create({
      data: {
        id,
        email,
        name: parsed.data.name,
        studentNumber: parsed.data.studentNumber,
        credential: { create: { passwordHash } },
        auditLogs: {
          create: { action: "USER_REGISTERED", targetType: "USER", targetId: id },
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/signup?error=email_in_use");
    }
    redirect("/signup?error=signup_failed");
  }
  await createUserSession(id);
  redirect("/dashboard");
}

export async function logout() {
  await revokeCurrentSession();
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
