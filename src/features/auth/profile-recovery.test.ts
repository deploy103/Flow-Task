import { SystemRole, type User as DatabaseUser } from "@prisma/client";
import type { User as AuthUser } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { ensureUserProfile, type UserProfileRepository } from "./profile-recovery";

const authUser = {
  id: "fd7736d1-ecc0-4c23-b12c-84077b66dca4",
  aud: "authenticated",
  role: "authenticated",
  email: "student@example.com",
  app_metadata: {},
  user_metadata: { name: "김학생", student_number: "202601" },
  created_at: "2026-07-16T00:00:00Z",
} satisfies AuthUser;

function createDatabaseUser(name = "김학생"): DatabaseUser {
  return {
    id: authUser.id,
    email: authUser.email ?? "student@example.com",
    name,
    studentNumber: "202601",
    systemRole: SystemRole.USER,
    createdAt: new Date("2026-07-16T00:00:00Z"),
    updatedAt: new Date("2026-07-16T00:00:00Z"),
  };
}

describe("profile recovery", () => {
  it("recovers on login retry after the initial profile creation fails", async () => {
    let storedProfile: DatabaseUser | null = null;
    let failNextCreate = true;
    const repository: UserProfileRepository = {
      findById: async () => storedProfile,
      create: async (input) => {
        if (failNextCreate) {
          failNextCreate = false;
          throw new Error("DATABASE_UNAVAILABLE");
        }
        const createdProfile = {
          ...createDatabaseUser(input.name),
          ...input,
          studentNumber: input.studentNumber ?? null,
        };
        storedProfile = createdProfile;
        return createdProfile;
      },
    };

    await expect(ensureUserProfile(authUser, { repository })).rejects.toThrow("DATABASE_UNAVAILABLE");
    await expect(ensureUserProfile(authUser, { repository })).resolves.toMatchObject({
      id: authUser.id,
      name: "김학생",
      studentNumber: "202601",
    });
  });

  it("returns an existing profile without overwriting it", async () => {
    const existingProfile = createDatabaseUser("기존 이름");
    let createCalls = 0;
    const repository: UserProfileRepository = {
      findById: async () => existingProfile,
      create: async () => {
        createCalls += 1;
        return existingProfile;
      },
    };

    const recovered = await ensureUserProfile(authUser, { repository });
    expect(recovered.name).toBe("기존 이름");
    expect(createCalls).toBe(0);
  });

  it("handles another request creating the profile concurrently", async () => {
    let storedProfile: DatabaseUser | null = null;
    const repository: UserProfileRepository = {
      findById: async () => storedProfile,
      create: async () => {
        storedProfile = createDatabaseUser();
        throw new Error("UNIQUE_CONSTRAINT");
      },
    };

    await expect(ensureUserProfile(authUser, { repository })).resolves.toMatchObject({
      id: authUser.id,
      name: "김학생",
    });
  });

  it("uses a safe default when editable metadata is invalid", async () => {
    const unsafeMetadataUser = {
      ...authUser,
      user_metadata: { name: "x".repeat(500), student_number: "../../etc/passwd" },
    } as AuthUser;
    let storedProfile: DatabaseUser | null = null;
    const repository: UserProfileRepository = {
      findById: async () => storedProfile,
      create: async (input) => {
        const createdProfile = {
          ...createDatabaseUser(input.name),
          ...input,
          studentNumber: input.studentNumber ?? null,
        };
        storedProfile = createdProfile;
        return createdProfile;
      },
    };

    const recovered = await ensureUserProfile(unsafeMetadataUser, { repository });
    expect(recovered.name).toBe("새 사용자");
    expect(recovered.studentNumber).toBeNull();
  });
});
