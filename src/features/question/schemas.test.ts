import { QuestionBoardType, QuestionCategory } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createQuestionSchema, mentorRelationSchema } from "./schemas";

describe("question schemas", () => {
  it("validates bounded structured questions", () => {
    expect(createQuestionSchema.safeParse({ organizationId: "550e8400-e29b-41d4-a716-446655440000", boardType: QuestionBoardType.PUBLIC_QNA, category: QuestionCategory.WEB, title: "로그인 오류", content: "재현 가능한 로그인 오류 내용입니다.", attempted: "쿠키 삭제", errorMessage: "403", code: "fetch('/')", relatedAssignmentId: "" }).success).toBe(true);
  });
  it("rejects self mentor relationships", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(mentorRelationSchema.safeParse({ organizationId: id, mentorId: id, menteeId: id, type: "PRIMARY" }).success).toBe(false);
  });
});
