import { QuizQuestionType, QuizResultRelease } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createQuizQuestionSchema, createQuizSchema, parseQuizChoices, parseQuizTags } from "./schemas";

const context = { organizationId: "11111111-1111-4111-8111-111111111111", assignmentId: "22222222-2222-4222-8222-222222222222" };

describe("quiz schemas", () => {
  it("validates bounded quiz settings", () => {
    expect(createQuizSchema.safeParse({ ...context, title: "보안 기초", description: "설명", attemptLimit: "2", timeLimitMinutes: "40", resultRelease: QuizResultRelease.AFTER_GRADING }).success).toBe(true);
    expect(createQuizSchema.safeParse({ ...context, title: "보안 기초", description: "설명", attemptLimit: "0", resultRelease: QuizResultRelease.IMMEDIATE }).success).toBe(false);
  });

  it("requires exactly one marked answer for single choice", () => {
    const base = { ...context, quizId: "33333333-3333-4333-8333-333333333333", type: QuizQuestionType.SINGLE_CHOICE, prompt: "정답?", points: "5", difficulty: "초급", choices: "오답\n*정답", required: "on" };
    expect(createQuizQuestionSchema.safeParse(base).success).toBe(true);
    expect(createQuizQuestionSchema.safeParse({ ...base, choices: "*하나\n*둘" }).success).toBe(false);
  });

  it("keeps answer and tag parsing deterministic", () => {
    expect(parseQuizChoices("  *정답\n오답 ")).toEqual([{ content: "정답", isCorrect: true }, { content: "오답", isCorrect: false }]);
    expect(parseQuizTags("Web, SQLi, Web")).toEqual(["Web", "SQLi"]);
  });
});
