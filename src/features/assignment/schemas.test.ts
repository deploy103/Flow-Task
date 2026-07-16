import { AssignmentAudience, AssignmentFieldType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  assignmentFieldTypesSchema,
  assignmentTargetIdsSchema,
  createAssignmentSchema,
} from "./schemas";

const validInput = {
  organizationId: "fd7736d1-ecc0-4c23-b12c-84077b66dca4",
  title: "1주차 활동 보고서",
  description: "활동 내용을 정리해 제출하세요.",
  audience: AssignmentAudience.ALL_MEMBERS,
  opensAt: "2026-07-16T09:00",
  deadline: "2026-07-18T18:00",
  allowLate: "on",
};

describe("assignment schemas", () => {
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

  it("requires one to three unique supported submission fields", () => {
    expect(assignmentFieldTypesSchema.safeParse([]).success).toBe(false);
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
