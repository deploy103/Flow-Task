import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";

const mail = vi.hoisted(() => ({ sendMail: vi.fn(), createTransport: vi.fn() }));
vi.mock("nodemailer", () => ({ createTransport: mail.createTransport }));

describe("authentication email delivery", () => {
  beforeEach(() => {
    vi.stubEnv("SMTP_HOST", "smtp");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_SECURE", "false");
    vi.stubEnv("AUTH_EMAIL_FROM", "Flow Task <noreply@example.com>");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://flow.mvtp.cloud");
    mail.sendMail.mockReset().mockResolvedValue({ messageId: "test" });
    mail.createTransport.mockReset().mockReturnValue({ sendMail: mail.sendMail });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("escapes user-controlled HTML while preserving the verification link", async () => {
    const link = `https://flow.mvtp.cloud/auth/verify-email?token=${"a".repeat(43)}`;

    await sendVerificationEmail("student@example.com", "<script>alert(1)</script>", link);

    expect(mail.createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: "smtp", port: 587, secure: false, disableFileAccess: true, disableUrlAccess: true }));
    const message = mail.sendMail.mock.calls[0][0] as { html: string; to: string };
    expect(message.to).toBe("student@example.com");
    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&lt;script&gt;");
    expect(message.html).toContain(link.replaceAll("&", "&amp;"));
  });

  it("fails closed when the SMTP server rejects a reset email", async () => {
    mail.sendMail.mockRejectedValueOnce(new Error("SMTP rejected"));
    await expect(sendPasswordResetEmail("student@example.com", "학생", "https://flow.mvtp.cloud/reset-password?token=test"))
      .rejects.toThrow("SMTP rejected");
  });
});
