import { SystemRole, type User } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  notFound: vi.fn((): never => { throw new Error("NEXT_NOT_FOUND"); }),
  redirect: vi.fn((path: string): never => { throw new Error(`NEXT_REDIRECT:${path}`); }),
}));
const session = vi.hoisted(() => ({ getCurrentSessionUser: vi.fn() }));

vi.mock("next/navigation", () => navigation);
vi.mock("@/features/auth/session", () => session);

import { requireSystemAdministrator } from "@/features/auth/guards";

const baseUser: User = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "member@example.com",
  name: "테스트 사용자",
  studentNumber: null,
  birthDate: null,
  privacyConsentAt: null,
  privacyConsentVersion: null,
  systemRole: SystemRole.USER,
  createdAt: new Date("2026-07-21T00:00:00Z"),
  updatedAt: new Date("2026-07-21T00:00:00Z"),
  emailVerifiedAt: new Date("2026-07-21T00:00:00Z"),
};

describe("system administrator guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects unauthenticated requests before granting access", async () => {
    session.getCurrentSessionUser.mockResolvedValue(null);

    await expect(requireSystemAdministrator()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(navigation.redirect).toHaveBeenCalledWith("/login");
    expect(navigation.notFound).not.toHaveBeenCalled();
  });

  it("returns not found for authenticated regular users", async () => {
    session.getCurrentSessionUser.mockResolvedValue(baseUser);

    await expect(requireSystemAdministrator()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(navigation.notFound).toHaveBeenCalledOnce();
  });

  it("returns the authenticated system administrator", async () => {
    const administrator = { ...baseUser, systemRole: SystemRole.SYSTEM_ADMIN };
    session.getCurrentSessionUser.mockResolvedValue(administrator);

    await expect(requireSystemAdministrator()).resolves.toEqual(administrator);
    expect(navigation.redirect).not.toHaveBeenCalled();
    expect(navigation.notFound).not.toHaveBeenCalled();
  });
});
