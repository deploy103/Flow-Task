import { AssignmentAudience, AssignmentFieldType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ASSIGNMENT_SETUP_TYPE } from "@/constants/assignment";
import {
  assignmentFieldTypesSchema,
  assignmentReferenceSchema,
  assignmentTargetIdsSchema,
  createAssignmentSchema,
} from "./schemas";

const validInput = {
  organizationId: "fd7736d1-ecc0-4c23-b12c-84077b66dca4",
  setupType: ASSIGNMENT_SETUP_TYPE.GENERAL_SUBMISSION,
  title: "1주차 활동 보고서",
  description: "활동 내용을 정리해 제출하세요.",
  audience: AssignmentAudience.ALL_MEMBERS,
  opensAt: "2026-07-16T09:00",
  deadline: "2026-07-18T18:00",
  allowLate: "on",
};

describe("assignment schemas", () => {
  it("validates assignment archive references", () => {
    expect(assignmentReferenceSchema.safeParse({
      organizationId: "550e8400-e29b-41d4-a716-446655440000",
      assignmentId: "550e8400-e29b-41d4-a716-446655440001",
    }).success).toBe(true);
    expect(assignmentReferenceSchema.safeParse({
      organizationId: "not-a-uuid",
      assignmentId: "550e8400-e29b-41d4-a716-446655440001",
    }).success).toBe(false);
  });

  it("converts KST date input to UTC and parses checkbox values", () => {
    const result = createAssignmentSchema.parse(validInput);
    expect(result.opensAt.toISOString()).toBe("2026-07-16T00:00:00.000Z");
    expect(result.deadline.toISOString()).toBe("2026-07-18T09:00:00.000Z");
    expect(result.allowLate).toBe(true);
  });

  it("rejects a deadline that is not later than the opening date", () => {
    const result = createAssignmentSchema.safeParse({
      ...validInput,
      deadline: "2026-07-16T08:59",
    });
    expect(result.success).toBe(false);
  });

  it("rejects calendar dates and times that JavaScript would normalize", () => {
    expect(
      createAssignmentSchema.safeParse({ ...validInput, opensAt: "2026-02-31T09:00" }).success,
    ).toBe(false);
    expect(
      createAssignmentSchema.safeParse({ ...validInput, opensAt: "2026-01-01T24:00" }).success,
    ).toBe(false);
  });

  it("accepts a leap day only in a leap year", () => {
    expect(
      createAssignmentSchema.safeParse({
        ...validInput,
        opensAt: "2024-02-29T09:00",
        deadline: "2024-03-01T09:00",
      }).success,
    ).toBe(true);
    expect(
      createAssignmentSchema.safeParse({ ...validInput, opensAt: "2026-02-29T09:00" }).success,
    ).toBe(false);
  });

  it("rejects invalid target IDs and target lists above policy", () => {
    expect(assignmentTargetIdsSchema.safeParse(["not-a-uuid"]).success).toBe(false);
    expect(
      assignmentTargetIdsSchema.safeParse(
        Array.from({ length: 501 }, () => "fd7736d1-ecc0-4c23-b12c-84077b66dca4"),
      ).success,
    ).toBe(false);
  });

  it("accepts supported setup types and rejects manipulated values", () => {
    for (const setupType of Object.values(ASSIGNMENT_SETUP_TYPE)) {
      expect(createAssignmentSchema.safeParse({ ...validInput, setupType }).success).toBe(true);
    }
    expect(createAssignmentSchema.safeParse({ ...validInput, setupType: "SERVER_CTF" }).success).toBe(false);
  });

  it("accepts zero to three unique supported submission fields", () => {
    expect(assignmentFieldTypesSchema.safeParse([]).success).toBe(true);
    expect(
      assignmentFieldTypesSchema.safeParse([
        AssignmentFieldType.TEXT,
        AssignmentFieldType.FILE,
        AssignmentFieldType.LINK,
      ]).success,
    ).toBe(true);
    expect(
      assignmentFieldTypesSchema.safeParse([AssignmentFieldType.TEXT, AssignmentFieldType.TEXT])
        .success,
    ).toBe(false);
  });
});
