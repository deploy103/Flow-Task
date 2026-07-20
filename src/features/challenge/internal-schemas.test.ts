import { ChallengeCategory, ChallengeConnectionProtocol, InternalChallengeMode } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createInternalChallengeSchema, parseChallengeHints } from "./internal-schemas";

const base = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  assignmentId: "22222222-2222-4222-8222-222222222222",
  title: "Login Bypass",
  description: "관리자로 로그인하세요.",
  category: ChallengeCategory.WEB,
  difficulty: "Easy",
  points: "100",
  flag: "CTF{answer}",
  penaltyPerWrongAttempt: "5",
};

describe("internal challenge schemas", () => {
  it("accepts a static challenge and bounded hints", () => {
    const result = createInternalChallengeSchema.safeParse({ ...base, mode: InternalChallengeMode.STATIC_FILE, hints: "첫 번째\n\n두 번째" });
    expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(true);
    expect(parseChallengeHints(result.success ? result.data.hints : undefined)).toEqual(["첫 번째", "두 번째"]);
  });

  it("requires complete shared server connection data", () => {
    expect(createInternalChallengeSchema.safeParse({ ...base, mode: InternalChallengeMode.SHARED_SERVER }).success).toBe(false);
    const result = createInternalChallengeSchema.safeParse({ ...base, mode: InternalChallengeMode.SHARED_SERVER, protocol: ChallengeConnectionProtocol.TCP, host: "challenge.example.com", port: "31337" });
    expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(true);
  });

  it("rejects URL-like hosts, invalid ports, inconsistent modes and missing flags", () => {
    expect(createInternalChallengeSchema.safeParse({ ...base, mode: InternalChallengeMode.SHARED_SERVER, protocol: ChallengeConnectionProtocol.HTTPS, host: "https://example.com", port: "443" }).success).toBe(false);
    expect(createInternalChallengeSchema.safeParse({ ...base, mode: InternalChallengeMode.SHARED_SERVER, protocol: ChallengeConnectionProtocol.TCP, host: "example.com", port: "65536" }).success).toBe(false);
    expect(createInternalChallengeSchema.safeParse({ ...base, mode: InternalChallengeMode.STATIC_FILE, protocol: ChallengeConnectionProtocol.TCP, host: "example.com", port: "1" }).success).toBe(false);
    expect(createInternalChallengeSchema.safeParse({ ...base, flag: "", mode: InternalChallengeMode.STATIC_FILE }).success).toBe(false);
  });

  it("keeps connection, resource, relation and RLS guarantees in the migration", () => {
    const migration = readFileSync(
      new URL("../../../prisma/migrations/20260720070500_add_internal_ctf_challenges/migration.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain("internal_challenges_connection_check");
    expect(migration).toContain("challenge_resources_size_check");
    expect(migration).toContain('REFERENCES "assignment_items"("id")');
    expect(migration).toContain('ALTER TABLE "challenge_resources" ENABLE ROW LEVEL SECURITY');
  });
});
import { readFileSync } from "node:fs";
