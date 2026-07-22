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
});
