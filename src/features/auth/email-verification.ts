import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuthToken, hashAuthToken } from "./token";

const VERIFICATION_LIFETIME_MILLISECONDS = 24 * 60 * 60 * 1_000;

export async function issueEmailVerificationToken(userId: string) {
  const issued = createAuthToken(VERIFICATION_LIFETIME_MILLISECONDS);
  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({ where: { userId, consumedAt: null } }),
    prisma.emailVerificationToken.create({
      data: { userId, tokenHash: issued.tokenHash, expiresAt: issued.expiresAt },
    }),
  ]);
  return issued.token;
}

export async function consumeEmailVerificationToken(token: string) {
  const tokenHash = hashAuthToken(token);
  if (!tokenHash) return false;

  return prisma.$transaction(async (transaction) => {
    const stored = await transaction.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!stored) return false;
    const consumed = await transaction.emailVerificationToken.updateMany({
      where: { id: stored.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) return false;
    await transaction.user.update({
      where: { id: stored.userId },
      data: {
        emailVerifiedAt: new Date(),
        auditLogs: { create: { action: "EMAIL_VERIFIED", targetType: "USER", targetId: stored.userId } },
      },
    });
    return true;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
