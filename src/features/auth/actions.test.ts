import { beforeEach, describe, expect, it, vi } from "vitest";

const guard = vi.hoisted(() => ({ requireAuthenticatedUser: vi.fn() }));
const navigation = vi.hoisted(() => ({
  redirect: vi.fn((path: string): never => { throw new Error(`NEXT_REDIRECT:${path}`); }),
}));
const password = vi.hoisted(() => ({ hashPassword: vi.fn(), verifyPassword: vi.fn() }));
const session = vi.hoisted(() => ({
  createUserSession: vi.fn(),
  revokeCurrentSession: vi.fn(),
}));
const rateLimit = vi.hoisted(() => ({ consumeAuthAttempt: vi.fn(), consumeEmailDeliveryCooldown: vi.fn() }));
const database = vi.hoisted(() => ({
  userCredential: { findUnique: vi.fn(), update: vi.fn() },
  authSession: { deleteMany: vi.fn() },
  passwordResetToken: { deleteMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("./guards", () => guard);
vi.mock("next/navigation", () => navigation);
vi.mock("./password", () => password);
vi.mock("./session", () => session);
vi.mock("./rate-limit", () => rateLimit);
vi.mock("@/lib/prisma", () => ({ prisma: database }));

import { changePassword } from "./actions";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";

function passwordForm(currentPassword = "current-password") {
  const formData = new FormData();
  formData.set("currentPassword", currentPassword);
  formData.set("newPassword", "new-safe-password");
  formData.set("newPasswordConfirmation", "new-safe-password");
  return formData;
}

describe("account security actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guard.requireAuthenticatedUser.mockResolvedValue({ id: USER_ID, email: "user@example.com" });
    rateLimit.consumeAuthAttempt.mockResolvedValue(true);
    database.userCredential.findUnique.mockResolvedValue({ userId: USER_ID, passwordHash: "stored-hash" });
    password.verifyPassword.mockResolvedValue(true);
    password.hashPassword.mockResolvedValue("new-hash");
    database.userCredential.update.mockResolvedValue({ userId: USER_ID });
    database.authSession.deleteMany.mockResolvedValue({ count: 2 });
    database.passwordResetToken.deleteMany.mockResolvedValue({ count: 1 });
    database.auditLog.create.mockResolvedValue({ id: BigInt(1) });
    database.$transaction.mockResolvedValue([]);
  });

  it("changes the password, revokes every session, and requires a new login", async () => {
    await expect(changePassword(passwordForm())).rejects.toThrow(
      "NEXT_REDIRECT:/login?message=password_updated",
    );

    expect(password.verifyPassword).toHaveBeenCalledWith("current-password", "stored-hash");
    expect(rateLimit.consumeAuthAttempt).toHaveBeenCalledWith("PASSWORD", "user@example.com");
    expect(database.userCredential.update).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      data: { passwordHash: "new-hash" },
    });
    expect(database.authSession.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(session.revokeCurrentSession).toHaveBeenCalledOnce();
  });

  it("rejects an incorrect current password before changing authentication state", async () => {
    password.verifyPassword.mockResolvedValue(false);

    await expect(changePassword(passwordForm("wrong-password"))).rejects.toThrow(
      "NEXT_REDIRECT:/profile?error=current_password_incorrect#security",
    );
    expect(password.hashPassword).not.toHaveBeenCalled();
    expect(database.$transaction).not.toHaveBeenCalled();
    expect(session.revokeCurrentSession).not.toHaveBeenCalled();
  });
});
