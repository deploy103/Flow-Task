import { randomBytes } from "node:crypto";

const NONCE_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export function createContentSecurityNonce() {
  return randomBytes(16).toString("base64url");
}

export function buildContentSecurityPolicy(nonce: string, production: boolean) {
  if (!NONCE_PATTERN.test(nonce)) throw new Error("INVALID_CSP_NONCE");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${production ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    ...(production ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
