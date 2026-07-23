import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("organization logo migration", () => {
  const migration = readFileSync(new URL("../../../prisma/migrations/20260723030000_add_organization_logo/migration.sql", import.meta.url), "utf8");
  it("keeps existing organizations compatible and logo metadata complete", () => {
    expect(migration).not.toMatch(/ADD COLUMN "logo_[^"]+"[^,;]+NOT NULL/);
    expect(migration).toContain("organizations_logo_complete_check");
    expect(migration).toContain("organizations_logo_storage_path_key");
  });
});
