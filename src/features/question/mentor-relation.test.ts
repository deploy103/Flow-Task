import { readFileSync } from "node:fs";
import { MembershipRole, MembershipStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canAssignMentorRelation } from "./mentor-relation";

const active = (role: MembershipRole) => ({ role, status: MembershipStatus.ACTIVE });

describe("mentor relation assignment", () => {
  it("only accepts an active mentor and an active member", () => {
    expect(canAssignMentorRelation(active(MembershipRole.MENTOR), active(MembershipRole.MEMBER))).toBe(true);
    expect(canAssignMentorRelation(active(MembershipRole.MENTOR), active(MembershipRole.MENTOR))).toBe(false);
    expect(canAssignMentorRelation(active(MembershipRole.MENTOR), active(MembershipRole.ORG_ADMIN))).toBe(false);
    expect(canAssignMentorRelation(active(MembershipRole.ORG_ADMIN), active(MembershipRole.MEMBER))).toBe(false);
    expect(canAssignMentorRelation(active(MembershipRole.MENTOR), { role: MembershipRole.MEMBER, status: MembershipStatus.INACTIVE })).toBe(false);
  });

  it("keeps one active primary mentor per organization and mentee at the database layer", () => {
    const migration = readFileSync(
      new URL("../../../prisma/migrations/20260719213000_enforce_single_primary_mentor/migration.sql", import.meta.url),
      "utf8",
    );

    expect(migration).toContain("CREATE UNIQUE INDEX \"mentor_relations_one_active_primary_per_mentee_key\"");
    expect(migration).toContain("(\"organization_id\", \"mentee_id\")");
    expect(migration).toContain("WHERE \"type\" = 'PRIMARY' AND \"ended_at\" IS NULL");
  });
});
