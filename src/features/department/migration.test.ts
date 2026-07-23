import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("department migration", () => {
  const migration = readFileSync(new URL("../../../prisma/migrations/20260723050000_add_departments_and_chat/migration.sql", import.meta.url), "utf8");
  it("limits each department to one lead and scopes names per organization", () => {
    expect(migration).toContain("department_members_single_lead_idx");
    expect(migration).toContain("WHERE \"role\" = 'LEAD'");
    expect(migration).toContain("departments_organization_id_name_key");
  });
  it("cascades department-owned membership and messages only", () => {
    expect(migration).toContain('department_members_department_id_fkey');
    expect(migration).toContain('department_messages_department_id_fkey');
    expect(migration).toContain("ON DELETE CASCADE");
    expect(migration).toContain('department_messages_author_id_fkey');
  });
  it("enables row level security on every department table", () => {
    for (const table of ["departments", "department_members", "department_messages"]) {
      expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    }
  });
});
