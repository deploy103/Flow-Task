import { InternalChallengeMode } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createInternalChallengeSchema } from "./internal-schemas";

describe("personal challenge instance policy", () => {
  const base = { organizationId: "11111111-1111-4111-8111-111111111111", assignmentId: "22222222-2222-4222-8222-222222222222", title: "개인 서버", description: "설명", category: "WEB", difficulty: "초급", points: "100", mode: InternalChallengeMode.PERSONAL_INSTANCE, flag: "CTF{x}", penaltyPerWrongAttempt: "0" };
  it("requires an opaque template and bounded resources", () => {
    expect(createInternalChallengeSchema.safeParse({ ...base, instanceTemplateRef: "web-basic-v1", instanceCpuMilli: "500", instanceMemoryMb: "256", instanceLifetimeMinutes: "60" }).success).toBe(true);
    expect(createInternalChallengeSchema.safeParse({ ...base, instanceTemplateRef: "docker.io/untrusted/image", instanceCpuMilli: "500", instanceMemoryMb: "256", instanceLifetimeMinutes: "60" }).success).toBe(false);
    expect(createInternalChallengeSchema.safeParse({ ...base, instanceTemplateRef: "web-basic-v1", instanceCpuMilli: "5000", instanceMemoryMb: "256", instanceLifetimeMinutes: "60" }).success).toBe(false);
  });
});
