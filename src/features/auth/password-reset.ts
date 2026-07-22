import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "./password";
import { createAuthToken, hashAuthToken } from "./token";

const RESET_LIFETIME_MILLISECONDS = 30 * 60 * 1_000;

export async function issuePasswordResetToken(userId: string) {
  const issued = createAuthToken(RESET_LIFETIME_MILLISECONDS);
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId, consumedAt: null } }),
    prisma.passwordResetToken.create({
      data: { userId, tokenHash: issued.tokenHash, expiresAt: issued.expiresAt },
    }),
  ]);
  return issued.token;
}

export async function resetPasswordWithToken(token: string, password: string) {
  const tokenHash = hashAuthToken(token);
  if (!tokenHash) return false;
  const passwordHash = await hashPassword(password);

  return prisma.$transaction(async (transaction) => {
    const stored = await transaction.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!stored) return false;
    const consumed = await transaction.passwordResetToken.updateMany({
      where: { id: stored.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) return false;
    await transaction.userCredential.update({ where: { userId: stored.userId }, data: { passwordHash } });
    await transaction.authSession.deleteMany({ where: { userId: stored.userId } });
    await transaction.passwordResetToken.updateMany({
      where: { userId: stored.userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await transaction.auditLog.create({
      data: { actorId: stored.userId, action: "PASSWORD_RESET", targetType: "USER", targetId: stored.userId },
    });
    return true;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
