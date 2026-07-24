import { readFileSync } from "node:fs";
import { MembershipStatus, MentoringRole, SecurityTrack } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canAssignMentorRelation } from "./mentor-relation";

const active = (mentoringRole: MentoringRole, securityTrack: SecurityTrack = SecurityTrack.PWNABLE) => ({ mentoringRole, securityTrack, status: MembershipStatus.ACTIVE });

describe("mentor relation assignment", () => {
  it("only connects active mentors and mentees in the same security track", () => {
    expect(canAssignMentorRelation(active(MentoringRole.MENTOR), active(MentoringRole.MENTEE))).toBe(true);
    expect(canAssignMentorRelation(active(MentoringRole.MENTOR), active(MentoringRole.MENTOR))).toBe(false);
    expect(canAssignMentorRelation(active(MentoringRole.MENTEE), active(MentoringRole.MENTEE))).toBe(false);
    expect(canAssignMentorRelation(active(MentoringRole.MENTOR), active(MentoringRole.MENTEE, SecurityTrack.FORENSICS))).toBe(false);
    expect(canAssignMentorRelation(active(MentoringRole.MENTOR), { mentoringRole: MentoringRole.MENTEE, securityTrack: SecurityTrack.PWNABLE, status: MembershipStatus.INACTIVE })).toBe(false);
    expect(canAssignMentorRelation({ mentoringRole: MentoringRole.MENTOR, securityTrack: null, status: MembershipStatus.ACTIVE }, active(MentoringRole.MENTEE))).toBe(false);
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
