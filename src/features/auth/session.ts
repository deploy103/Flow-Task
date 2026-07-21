import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "flow_task_session";
const SESSION_DURATION_MILLISECONDS = 14 * 24 * 60 * 60 * 1_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function hashSessionToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

export async function createUserSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MILLISECONDS);
  await prisma.$transaction([
    prisma.authSession.deleteMany({
      where: { userId, OR: [{ expiresAt: { lte: new Date() } }, { revokedAt: { not: null } }] },
    }),
    prisma.authSession.create({ data: { userId, tokenHash: hashSessionToken(token), expiresAt } }),
  ]);
  (await cookies()).set(SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt));
}

export async function getCurrentSessionUser() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token || !TOKEN_PATTERN.test(token)) return null;
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  return session.user;
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token && TOKEN_PATTERN.test(token)) {
    await prisma.authSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }
  cookieStore.set(SESSION_COOKIE_NAME, "", sessionCookieOptions(new Date(0)));
}
