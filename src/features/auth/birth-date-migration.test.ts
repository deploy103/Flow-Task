import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("birth date migration", () => {
  const migration = readFileSync(
    new URL("../../../prisma/migrations/20260723010000_add_user_birth_date/migration.sql", import.meta.url),
    "utf8",
  );

  it("adds a date-only nullable field so existing accounts remain valid", () => {
    expect(migration).toContain('ADD COLUMN "birth_date" DATE');
    expect(migration).not.toContain("NOT NULL");
  });

  it("records complete versioned consent evidence", () => {
    expect(migration).toContain('ADD COLUMN "privacy_consent_at" TIMESTAMPTZ(6)');
    expect(migration).toContain('ADD COLUMN "privacy_consent_version" VARCHAR(20)');
    expect(migration).toContain('CONSTRAINT "users_privacy_consent_complete_check"');
  });
});
