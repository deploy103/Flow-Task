import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const [{ usersTable, credentialsTable }] = await prisma.$queryRaw`
    SELECT
      to_regclass('public.users')::text AS "usersTable",
      to_regclass('public.user_credentials')::text AS "credentialsTable"
  `;

  if (!usersTable) {
    process.stdout.write("Local auth preflight passed: users table does not exist yet.\n");
  } else {
    const [{ missingCredentials }] = credentialsTable
      ? await prisma.$queryRaw`
          SELECT COUNT(*)::integer AS "missingCredentials"
          FROM "users" AS u
          LEFT JOIN "user_credentials" AS c ON c."user_id" = u."id"
          WHERE c."user_id" IS NULL
        `
      : await prisma.$queryRaw`
          SELECT COUNT(*)::integer AS "missingCredentials"
          FROM "users"
        `;

    if (missingCredentials !== 0) {
      throw new Error(
        `Local auth migration blocked: ${missingCredentials} user(s) do not have local credentials.`,
      );
    }
    process.stdout.write("Local auth preflight passed: 0 users require credentials.\n");
  }
} finally {
  await prisma.$disconnect();
}
