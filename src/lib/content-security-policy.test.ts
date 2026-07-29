import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, createContentSecurityNonce } from "./content-security-policy";

describe("content security policy", () => {
  const scriptDirective = (policy: string) =>
    policy.split("; ").find((directive) => directive.startsWith("script-src"));

  it("creates an unpredictable base64url nonce", () => {
    const first = createContentSecurityNonce();
    const second = createContentSecurityNonce();
    expect(first).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(second).not.toBe(first);
  });

  it("allows only nonce-bearing scripts in production", () => {
    const policy = buildContentSecurityPolicy("A23456789012345678901B", true);
    expect(policy).toContain("script-src 'self' 'nonce-A23456789012345678901B' 'strict-dynamic'");
    expect(scriptDirective(policy)).not.toContain("'unsafe-inline'");
    expect(scriptDirective(policy)).not.toContain("'unsafe-eval'");
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("keeps the development runtime available without allowing inline scripts", () => {
    const policy = buildContentSecurityPolicy("A23456789012345678901B", false);
    expect(scriptDirective(policy)).toContain("'unsafe-eval'");
    expect(scriptDirective(policy)).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("upgrade-insecure-requests");
  });

  it("rejects attacker-controlled nonce syntax", () => {
    expect(() => buildContentSecurityPolicy("bad'; script-src *", true)).toThrow("INVALID_CSP_NONCE");
  });
});
