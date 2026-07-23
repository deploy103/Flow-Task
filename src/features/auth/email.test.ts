import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";

describe("authentication email delivery", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key_long_enough_for_validation");
    vi.stubEnv("AUTH_EMAIL_FROM", "Flow Task <noreply@example.com>");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://flow.mvtp.cloud");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("escapes user-controlled HTML while preserving the verification link", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const link = `https://flow.mvtp.cloud/auth/verify-email?token=${"a".repeat(43)}`;

    await sendVerificationEmail("student@example.com", "<script>alert(1)</script>", link);

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(request.body as string) as { html: string; to: string[] };
    expect(body.to).toEqual(["student@example.com"]);
    expect(body.html).not.toContain("<script>");
    expect(body.html).toContain("&lt;script&gt;");
    expect(body.html).toContain(link.replaceAll("&", "&amp;"));
  });

  it("fails closed when the mail provider rejects a reset email", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 429 })));
    await expect(sendPasswordResetEmail("student@example.com", "학생", "https://flow.mvtp.cloud/reset-password?token=test"))
      .rejects.toThrow("AUTH_EMAIL_DELIVERY_FAILED_429");
  });
});
