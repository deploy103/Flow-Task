import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("submission cleanup migration", () => {
  const migration = readFileSync(
    new URL(
      "../../../prisma/migrations/20260716140500_harden_submission_upload_cleanup/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );

  it("does not use a newly added enum value before the transaction commits", () => {
    expect(migration).toContain('"status"::TEXT = \'CLEANED\'');
    expect(migration).toContain('"status"::TEXT <> \'CLEANED\'');
    expect(migration).not.toContain('"status" = \'CLEANED\'');
    expect(migration).not.toContain('"status" <> \'CLEANED\'');
  });
});
