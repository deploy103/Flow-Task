"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getAuthEmailEnvironment } from "@/lib/env";
import { emailRequestSchema, loginSchema, passwordChangeSchema, passwordResetSchema, profileSchema, signUpSchema, verificationTokenSchema } from "./schemas";
import { requireAuthenticatedUser } from "./guards";
import { hashPassword, verifyPassword } from "./password";
import { createUserSession, revokeCurrentSession } from "./session";
import { consumeAuthAttempt, consumeEmailDeliveryCooldown } from "./rate-limit";
import { buildAuthLink } from "./token";
import { consumeEmailVerificationToken, issueEmailVerificationToken } from "./email-verification";
import { issuePasswordResetToken, resetPasswordWithToken } from "./password-reset";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";
import { PRIVACY_POLICY_VERSION } from "@/constants/privacy";

export type AuthFormState = { error?: string };

export async function login(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid_input" };
  if (!(await consumeAuthAttempt("LOGIN", parsed.data.email))) return { error: "rate_limited" };

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: { credential: true },
  });
  if (!user?.credential) {
    await hashPassword(parsed.data.password);
    return { error: "invalid_credentials" };
  }
  if (!(await verifyPassword(parsed.data.password, user.credential.passwordHash))) {
    return { error: "invalid_credentials" };
  }
  if (!user.emailVerifiedAt) {
    redirect(`/verify-email?error=email_not_verified&email=${encodeURIComponent(email)}`);
  }
  await createUserSession(user.id, parsed.data.rememberMe);

  redirect("/dashboard");
}

export async function signUp(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid_input" };
  if (!(await consumeAuthAttempt("SIGNUP", parsed.data.email))) return { error: "rate_limited" };

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
        birthDate: parsed.data.birthDate,
        privacyConsentAt: new Date(),
        privacyConsentVersion: PRIVACY_POLICY_VERSION,
        credential: { create: { passwordHash } },
        auditLogs: {
          create: { action: "USER_REGISTERED", targetType: "USER", targetId: id },
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "email_in_use" };
    }
    return { error: "signup_failed" };
  }
  if (!(await consumeEmailDeliveryCooldown("VERIFY", email))) {
    redirect(`/verify-email?error=email_cooldown&email=${encodeURIComponent(email)}`);
  }
  try {
    const token = await issueEmailVerificationToken(id);
    const { NEXT_PUBLIC_APP_URL } = getAuthEmailEnvironment();
    await sendVerificationEmail(email, parsed.data.name, buildAuthLink(NEXT_PUBLIC_APP_URL, "/auth/verify-email", token));
  } catch {
    redirect(`/verify-email?error=verification_delivery_failed&email=${encodeURIComponent(email)}`);
  }
  redirect(`/verify-email?message=verification_sent&email=${encodeURIComponent(email)}`);
}

export async function resendVerificationEmail(formData: FormData) {
  const parsed = emailRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/verify-email?error=invalid_input");
  const email = parsed.data.email.toLowerCase();
  if (!(await consumeAuthAttempt("VERIFY", email))) redirect("/verify-email?error=rate_limited");
  if (!(await consumeEmailDeliveryCooldown("VERIFY", email))) {
    redirect(`/verify-email?error=email_cooldown&email=${encodeURIComponent(email)}`);
  }

  after(async () => {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || user.emailVerifiedAt) return;
      const token = await issueEmailVerificationToken(user.id);
      const { NEXT_PUBLIC_APP_URL } = getAuthEmailEnvironment();
      await sendVerificationEmail(email, user.name, buildAuthLink(NEXT_PUBLIC_APP_URL, "/auth/verify-email", token));
    } catch {
      // 계정 존재 여부와 메일 공급자 상태를 외부에 노출하지 않는다.
    }
  });
  redirect("/verify-email?message=verification_sent");
}

export async function confirmEmailVerification(formData: FormData) {
  const parsed = verificationTokenSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/verify-email?error=invalid_or_expired_verification");
  if (!(await consumeEmailVerificationToken(parsed.data.token))) {
    redirect("/verify-email?error=invalid_or_expired_verification");
  }
  redirect("/login?message=email_verified");
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = emailRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/forgot-password?error=invalid_input");
  const email = parsed.data.email.toLowerCase();
  if (!(await consumeAuthAttempt("RESET", email))) redirect("/forgot-password?error=rate_limited");
  if (!(await consumeEmailDeliveryCooldown("RESET", email))) {
    redirect("/forgot-password?error=email_cooldown");
  }

  after(async () => {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.emailVerifiedAt) return;
      const token = await issuePasswordResetToken(user.id);
      const { NEXT_PUBLIC_APP_URL } = getAuthEmailEnvironment();
      await sendPasswordResetEmail(email, user.name, buildAuthLink(NEXT_PUBLIC_APP_URL, "/reset-password", token));
    } catch {
      // 항상 동일한 응답을 반환해 가입 여부를 추측하지 못하게 한다.
    }
  });
  redirect("/forgot-password?message=reset_sent");
}

export async function resetPassword(formData: FormData) {
  const values = Object.fromEntries(formData);
  const parsed = passwordResetSchema.safeParse(values);
  if (!parsed.success) {
    const token = typeof values.token === "string" && /^[A-Za-z0-9_-]{43}$/.test(values.token) ? values.token : "";
    redirect(`/reset-password?error=invalid_reset_request${token ? `&token=${encodeURIComponent(token)}` : ""}`);
  }
  if (!(await consumeAuthAttempt("RESET", parsed.data.token))) redirect("/reset-password?error=rate_limited");
  if (!(await resetPasswordWithToken(parsed.data.token, parsed.data.password))) {
    redirect("/reset-password?error=invalid_or_expired_token");
  }
  redirect("/login?message=password_updated");
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

export async function changePassword(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const parsed = passwordChangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/profile?error=invalid_password_change#security");
  if (!(await consumeAuthAttempt("PASSWORD", user.email))) {
    redirect("/profile?error=password_change_rate_limited#security");
  }

  const credential = await prisma.userCredential.findUnique({ where: { userId: user.id } });
  if (!credential || !(await verifyPassword(parsed.data.currentPassword, credential.passwordHash))) {
    redirect("/profile?error=current_password_incorrect#security");
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  try {
    await prisma.$transaction([
      prisma.userCredential.update({ where: { userId: user.id }, data: { passwordHash } }),
      prisma.authSession.deleteMany({ where: { userId: user.id } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "PASSWORD_CHANGED",
          targetType: "USER",
          targetId: user.id,
        },
      }),
    ]);
  } catch {
    redirect("/profile?error=password_change_failed#security");
  }

  await revokeCurrentSession();
  redirect("/login?message=password_updated");
}
