import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import EmailVerificationConfirmationPage from "@/app/auth/verify-email/page";
import { prisma } from "@/lib/prisma";
import { consumeEmailVerificationToken, issueEmailVerificationToken } from "./email-verification";
import { issuePasswordResetToken, resetPasswordWithToken } from "./password-reset";
import { verifyPassword } from "./password";
import { createAuthToken } from "./token";

const describeWithDatabase = process.env.RUN_DATABASE_TESTS === "1" ? describe : describe.skip;

describeWithDatabase("email verification and password reset database behavior", () => {
  const userIds = new Set<string>();

  async function createUser(verified = false) {
    const id = randomUUID();
    userIds.add(id);
    return prisma.user.create({
      data: {
        id,
        email: `auth-${id}@example.com`,
        name: "인증 테스트",
        emailVerifiedAt: verified ? new Date() : null,
        credential: { create: { passwordHash: "integration-test-placeholder" } },
      },
    });
  }

  beforeAll(async () => {
    if (process.env.RUN_DATABASE_TESTS !== "1") throw new Error("Database tests must be explicit.");
    const [database] = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS "name"`;
    if (!database?.name.endsWith("_test")) throw new Error("Email auth integration tests require a *_test database.");
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [...userIds] } } });
    await prisma.$disconnect();
  });

  it("does not consume a verification token while rendering the initial GET page", async () => {
    const user = await createUser();
    const token = await issueEmailVerificationToken(user.id);

    await EmailVerificationConfirmationPage({ searchParams: Promise.resolve({ token }) });

    await expect(prisma.user.findUnique({ where: { id: user.id }, select: { emailVerifiedAt: true } }))
      .resolves.toEqual({ emailVerifiedAt: null });
    await expect(prisma.emailVerificationToken.findFirst({ where: { userId: user.id }, select: { consumedAt: true } }))
      .resolves.toEqual({ consumedAt: null });
  });

  it("verifies once and invalidates an older issued verification link", async () => {
    const user = await createUser();
    const replacedToken = await issueEmailVerificationToken(user.id);
    const currentToken = await issueEmailVerificationToken(user.id);

    await expect(consumeEmailVerificationToken(replacedToken)).resolves.toBe(false);
    await expect(consumeEmailVerificationToken(currentToken)).resolves.toBe(true);
    await expect(consumeEmailVerificationToken(currentToken)).resolves.toBe(false);
    await expect(prisma.user.findUnique({ where: { id: user.id }, select: { emailVerifiedAt: true } }))
      .resolves.toMatchObject({ emailVerifiedAt: expect.any(Date) });
  });

  it("rejects expired verification and permits only one concurrent consumer", async () => {
    const expiredUser = await createUser();
    const expiredToken = await issueEmailVerificationToken(expiredUser.id);
    await prisma.emailVerificationToken.updateMany({ where: { userId: expiredUser.id }, data: { expiresAt: new Date(0) } });
    await expect(consumeEmailVerificationToken(expiredToken)).resolves.toBe(false);

    const concurrentUser = await createUser();
    const concurrentToken = await issueEmailVerificationToken(concurrentUser.id);
    const results = await Promise.all([
      consumeEmailVerificationToken(concurrentToken),
      consumeEmailVerificationToken(concurrentToken),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("resets once, changes the hash, and revokes every session and remaining reset link", async () => {
    const user = await createUser(true);
    await prisma.authSession.createMany({
      data: ["first", "second"].map((value) => ({
        userId: user.id,
        tokenHash: createHash("sha256").update(`${user.id}:${value}`).digest("hex"),
        expiresAt: new Date(Date.now() + 60_000),
      })),
    });
    const token = await issuePasswordResetToken(user.id);
    const remaining = createAuthToken(60_000);
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: remaining.tokenHash, expiresAt: remaining.expiresAt },
    });

    await expect(resetPasswordWithToken(token, "replacement-password")).resolves.toBe(true);
    await expect(resetPasswordWithToken(token, "replacement-password")).resolves.toBe(false);
    const credential = await prisma.userCredential.findUniqueOrThrow({ where: { userId: user.id } });
    await expect(verifyPassword("replacement-password", credential.passwordHash)).resolves.toBe(true);
    await expect(prisma.authSession.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.passwordResetToken.count({ where: { userId: user.id, consumedAt: null } })).resolves.toBe(0);
  });

  it("rejects expired reset links and permits only one concurrent password change", async () => {
    const expiredUser = await createUser(true);
    const expiredToken = await issuePasswordResetToken(expiredUser.id);
    await prisma.passwordResetToken.updateMany({ where: { userId: expiredUser.id }, data: { expiresAt: new Date(0) } });
    await expect(resetPasswordWithToken(expiredToken, "replacement-password")).resolves.toBe(false);

    const concurrentUser = await createUser(true);
    const concurrentToken = await issuePasswordResetToken(concurrentUser.id);
    const results = await Promise.all([
      resetPasswordWithToken(concurrentToken, "replacement-password"),
      resetPasswordWithToken(concurrentToken, "replacement-password"),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
