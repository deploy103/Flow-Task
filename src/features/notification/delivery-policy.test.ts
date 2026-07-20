import { describe, expect, it } from "vitest";

describe("notification delivery retry contract", () => {
  it("keeps the database retry ceiling and queue index in the migration", async () => {
    const migration = await import("node:fs").then(({ readFileSync }) => readFileSync(new URL("../../../prisma/migrations/20260720112000_add_advanced_features/migration.sql", import.meta.url), "utf8"));
    expect(migration).toContain('"attempts" BETWEEN 0 AND 5');
    expect(migration).toContain('"notification_deliveries_status_next_attempt_at_idx"');
  });
});
