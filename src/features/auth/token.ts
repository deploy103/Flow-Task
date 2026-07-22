import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function hashAuthToken(token: string) {
  if (!TOKEN_PATTERN.test(token)) return null;
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createAuthToken(lifetimeMilliseconds: number, now = Date.now()) {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return {
    token,
    tokenHash: hashAuthToken(token)!,
    expiresAt: new Date(now + lifetimeMilliseconds),
  };
}

export function buildAuthLink(baseUrl: string, path: string, token: string) {
  const url = new URL(path, baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
