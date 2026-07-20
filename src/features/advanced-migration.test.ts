import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("advanced features migration", () => {
  const migration = readFileSync(new URL("../../prisma/migrations/20260720112000_add_advanced_features/migration.sql", import.meta.url), "utf8");
  it("enables RLS for every advanced table", () => {
    for (const table of ["notification_preferences", "web_push_subscriptions", "notification_deliveries", "organization_integrations", "challenge_instances", "quiz_integrity_events"]) expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  });
  it("enforces resource, lifecycle, digest and retry limits", () => {
    expect(migration).toContain('"instance_cpu_milli" BETWEEN 100 AND 2000');
    expect(migration).toContain('"instance_memory_mb" BETWEEN 64 AND 2048');
    expect(migration).toContain('"instance_lifetime_minutes" BETWEEN 5 AND 120');
    expect(migration).toContain('"attempts" BETWEEN 0 AND 5');
    expect(migration).toContain('"client_ip_digest" ~ \'^[0-9a-f]{64}$\'');
    expect(migration).toContain('jsonb_typeof("detail") = \'object\'');
  });
  it("contains no privileged Docker or host socket configuration", () => {
    expect(migration).not.toContain("docker.sock");
    expect(migration).not.toContain("privileged");
  });
  it("does not use the newly added instance enum value before commit", () => {
    expect(migration).toContain('"mode"::TEXT = \'PERSONAL_INSTANCE\'');
    expect(migration).toContain('"mode"::TEXT <> \'PERSONAL_INSTANCE\'');
    expect(migration).not.toContain('"mode" = \'PERSONAL_INSTANCE\'');
    expect(migration).not.toContain('"mode" <> \'PERSONAL_INSTANCE\'');
  });
});
