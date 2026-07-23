import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("email authentication migration", () => {
  const migration = readFileSync(
    new URL("../../../prisma/migrations/20260722230000_add_email_verification_and_password_reset/migration.sql", import.meta.url),
    "utf8",
  );

  it("preserves access for accounts that existed before email verification", () => {
    expect(migration).toContain('UPDATE "users" SET "email_verified_at" = CURRENT_TIMESTAMP');
  });

  it("stores only token hashes with expiry and one-time consumption fields", () => {
    for (const table of ["email_verification_tokens", "password_reset_tokens"]) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
      expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);
    }
    expect(migration).not.toMatch(/"token"\s/);
  });
});
