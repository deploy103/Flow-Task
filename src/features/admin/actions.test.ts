import { beforeEach, describe, expect, it, vi } from "vitest";
import { SystemRole } from "@prisma/client";

const guard = vi.hoisted(() => ({ requireSystemAdministrator: vi.fn() }));
const navigation = vi.hoisted(() => ({ redirect: vi.fn((path: string): never => { throw new Error(`NEXT_REDIRECT:${path}`); }) }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const transaction = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
  emailVerificationToken: { deleteMany: vi.fn() },
  passwordResetToken: { deleteMany: vi.fn() },
  authSession: { deleteMany: vi.fn() },
  auditLog: { create: vi.fn() },
}));
const database = vi.hoisted(() => ({ $transaction: vi.fn() }));

vi.mock("@/features/auth/guards", () => guard);
vi.mock("next/navigation", () => navigation);
vi.mock("next/cache", () => cache);
vi.mock("@/lib/prisma", () => ({ prisma: database }));

import { updateUserAsSystemAdmin } from "./actions";

const ACTOR_ID = "550e8400-e29b-41d4-a716-446655440000";
const TARGET_ID = "550e8400-e29b-41d4-a716-446655440001";

function userForm(email: string) {
  const formData = new FormData();
  formData.set("userId", TARGET_ID);
  formData.set("name", "관리 대상");
  formData.set("email", email);
  formData.set("studentNumber", "");
  formData.set("birthDate", "");
  formData.set("systemRole", "USER");
  return formData;
}

describe("system administrator user actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guard.requireSystemAdministrator.mockResolvedValue({ id: ACTOR_ID, systemRole: SystemRole.SYSTEM_ADMIN });
    transaction.user.findUnique.mockResolvedValue({ id: TARGET_ID, email: "old@example.com", systemRole: SystemRole.USER });
    transaction.user.count.mockResolvedValue(2);
    transaction.user.update.mockResolvedValue({ id: TARGET_ID });
    transaction.auditLog.create.mockResolvedValue({ id: BigInt(1) });
    database.$transaction.mockImplementation(async (callback: (client: typeof transaction) => unknown) => callback(transaction));
  });

  it("revokes verification, reset, and session state when email changes", async () => {
    await expect(updateUserAsSystemAdmin(userForm("new@example.com"))).rejects.toThrow("NEXT_REDIRECT:/admin/users?message=updated");

    expect(transaction.emailVerificationToken.deleteMany).toHaveBeenCalledWith({ where: { userId: TARGET_ID } });
    expect(transaction.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: TARGET_ID } });
    expect(transaction.authSession.deleteMany).toHaveBeenCalledWith({ where: { userId: TARGET_ID } });
    expect(transaction.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: "new@example.com", emailVerifiedAt: null }) }));
  });

  it("keeps verification and sessions when the email is unchanged", async () => {
    await expect(updateUserAsSystemAdmin(userForm("old@example.com"))).rejects.toThrow("NEXT_REDIRECT:/admin/users?message=updated");

    expect(transaction.emailVerificationToken.deleteMany).not.toHaveBeenCalled();
    expect(transaction.passwordResetToken.deleteMany).not.toHaveBeenCalled();
    expect(transaction.authSession.deleteMany).not.toHaveBeenCalled();
    const update = transaction.user.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(update.data).not.toHaveProperty("emailVerifiedAt");
  });
});
