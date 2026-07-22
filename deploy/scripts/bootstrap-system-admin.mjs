import { randomBytes, randomUUID, scrypt as nodeScrypt } from "node:crypto";
import { PrismaClient, SystemRole } from "@prisma/client";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim();

if (!email || !email.includes("@") || !password || password.length < 8 || !name || name.length < 2) {
  throw new Error("ADMIN_EMAIL, ADMIN_PASSWORD (8+ chars), and ADMIN_NAME are required.");
}

function scrypt(passwordValue, salt) {
  return new Promise((resolve, reject) => {
    nodeScrypt(passwordValue, salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

const salt = randomBytes(16);
const key = await scrypt(password, salt);
const passwordHash = ["scrypt", 16_384, 8, 1, salt.toString("base64url"), key.toString("base64url")].join("$");
const prisma = new PrismaClient();

try {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  const userId = existing?.id ?? randomUUID();
  await prisma.$transaction(async (transaction) => {
    await transaction.user.upsert({
      where: { email },
      create: { id: userId, email, name, systemRole: SystemRole.SYSTEM_ADMIN },
      update: { name, systemRole: SystemRole.SYSTEM_ADMIN },
    });
    await transaction.userCredential.upsert({
      where: { userId },
      create: { userId, passwordHash },
      update: { passwordHash },
    });
    await transaction.authSession.deleteMany({ where: { userId } });
    await transaction.auditLog.create({
      data: {
        actorId: userId,
        action: "SYSTEM_ADMIN_BOOTSTRAPPED",
        targetType: "USER",
        targetId: userId,
      },
    });
  });
  process.stdout.write("System administrator is ready.\n");
} finally {
  await prisma.$disconnect();
}
