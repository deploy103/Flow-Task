import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const BROWSER_SESSION_DURATION_MILLISECONDS = 24 * 60 * 60 * 1_000;
const PERSISTENT_SESSION_DURATION_MILLISECONDS = 30 * 24 * 60 * 60 * 1_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function hashSessionToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function getSessionCookieName(production = process.env.NODE_ENV === "production") {
  return production ? "__Host-flow_task_session" : "flow_task_session";
}

export function getSessionExpiration(persistent: boolean, now = Date.now()) {
  const duration = persistent ? PERSISTENT_SESSION_DURATION_MILLISECONDS : BROWSER_SESSION_DURATION_MILLISECONDS;
  return new Date(now + duration);
}

export function sessionCookieOptions(expires?: Date, production = process.env.NODE_ENV === "production") {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: production,
    path: "/",
    ...(expires ? { expires } : {}),
    priority: "high" as const,
  };
}

export async function createUserSession(userId: string, persistent = false) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = getSessionExpiration(persistent);
  await prisma.$transaction([
    prisma.authSession.deleteMany({
      where: { userId, OR: [{ expiresAt: { lte: new Date() } }, { revokedAt: { not: null } }] },
    }),
    prisma.authSession.create({ data: { userId, tokenHash: hashSessionToken(token), expiresAt } }),
  ]);
  (await cookies()).set(getSessionCookieName(), token, sessionCookieOptions(persistent ? expiresAt : undefined));
}

export async function getCurrentSessionUser() {
  const token = (await cookies()).get(getSessionCookieName())?.value;
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
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (token && TOKEN_PATTERN.test(token)) {
    await prisma.authSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }
  cookieStore.set(getSessionCookieName(), "", sessionCookieOptions(new Date(0)));
}
