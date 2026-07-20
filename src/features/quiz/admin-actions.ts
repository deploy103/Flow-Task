"use server";

import { AssignmentItemType, Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization } from "@/features/organization/permissions";
import { prisma } from "@/lib/prisma";
import { canAddQuizPoints } from "./admin-policy";
import { hashQuizAnswer } from "./answer-hash";
import {
  createQuizQuestionSchema,
  createQuizSchema,
  parseQuizAnswerLines,
  parseQuizChoices,
  parseQuizTags,
  quizContextSchema,
  reuseQuizQuestionSchema,
} from "./schemas";

const quizPath = (organizationId: string, assignmentId: string, quizId?: string) =>
  `/organizations/${organizationId}/assignments/${assignmentId}/quiz${quizId ? `/${quizId}/manage` : "/new"}`;

function contextFrom(formData: FormData) {
  return quizContextSchema.safeParse({ organizationId: formData.get("organizationId"), assignmentId: formData.get("assignmentId") });
}

export async function createQuiz(formData: FormData) {
  const context = contextFrom(formData);
  if (!context.success) redirect("/dashboard?quiz_error=invalid_input");
  const parsed = createQuizSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`${quizPath(context.data.organizationId, context.data.assignmentId)}?error=invalid_input`);
  const { organizationId, assignmentId } = context.data;
  const { user } = await requireOrganizationAccess(organizationId, true);
  let itemId: string;
  try {
    itemId = await prisma.$transaction(async (transaction) => {
      const membership = await transaction.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: user.id } } });
      if (!canManageOrganization({ systemRole: user.systemRole, membership })) throw new Error("FORBIDDEN");
      const assignment = await transaction.assignment.findFirst({ where: { id: assignmentId, organizationId, archivedAt: null }, select: { id: true } });
      if (!assignment) throw new Error("NOT_FOUND");
      const maximum = await transaction.assignmentItem.aggregate({ where: { assignmentId }, _max: { position: true } });
      const position = (maximum._max.position ?? -1) + 1;
      if (position > 2_147_483_647) throw new Error("POSITION_UNAVAILABLE");
      const item = await transaction.assignmentItem.create({
        data: {
          assignmentId,
          position,
          type: AssignmentItemType.QUIZ,
          quiz: { create: {
            title: parsed.data.title,
            description: parsed.data.description,
            timeLimitMinutes: parsed.data.timeLimitMinutes ?? null,
            attemptLimit: parsed.data.attemptLimit,
            passingScore: parsed.data.passingScore ?? null,
            shuffleQuestions: parsed.data.shuffleQuestions,
            shuffleChoices: parsed.data.shuffleChoices,
            resultRelease: parsed.data.resultRelease,
          } },
        },
        select: { id: true },
      });
      await transaction.auditLog.create({ data: { actorId: user.id, organizationId, action: "QUIZ_CREATED", targetType: "ASSIGNMENT_ITEM", targetId: item.id, metadata: { assignmentId, attemptLimit: parsed.data.attemptLimit, timeLimitMinutes: parsed.data.timeLimitMinutes ?? null } } });
      return item.id;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    redirect(`${quizPath(organizationId, assignmentId)}?error=create_failed`);
  }
  redirect(quizPath(organizationId, assignmentId, itemId));
}

export async function createQuizQuestion(formData: FormData) {
  const context = contextFrom(formData);
  if (!context.success) redirect("/dashboard?quiz_error=invalid_input");
  const parsed = createQuizQuestionSchema.safeParse(Object.fromEntries(formData));
  const { organizationId, assignmentId } = context.data;
  if (!parsed.success) redirect(`${quizPath(organizationId, assignmentId, String(formData.get("quizId")))}?error=invalid_question`);
  const { user } = await requireOrganizationAccess(organizationId, true);
  const choices = parseQuizChoices(parsed.data.choices);
  const accepted = parseQuizAnswerLines(parsed.data.acceptedAnswers);
  let digests: string[];
  try {
    digests = accepted.map((answer) => hashQuizAnswer(answer, { caseSensitive: parsed.data.caseSensitive, trimWhitespace: parsed.data.trimWhitespace }));
  } catch {
    redirect(`${quizPath(organizationId, assignmentId, parsed.data.quizId)}?error=create_failed`);
  }
  try {
    await prisma.$transaction(async (transaction) => {
      const membership = await transaction.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: user.id } } });
      if (!canManageOrganization({ systemRole: user.systemRole, membership })) throw new Error("FORBIDDEN");
      const quiz = await transaction.quiz.findFirst({ where: { assignmentItemId: parsed.data.quizId, assignmentItem: { assignmentId, assignment: { organizationId, archivedAt: null } } }, select: { assignmentItemId: true } });
      if (!quiz) throw new Error("NOT_FOUND");
      const [maximum, total] = await Promise.all([
        transaction.quizQuestionPlacement.aggregate({ where: { quizId: quiz.assignmentItemId }, _max: { position: true } }),
        transaction.quizQuestion.aggregate({ where: { placements: { some: { quizId: quiz.assignmentItemId } } }, _sum: { points: true } }),
      ]);
      if (!canAddQuizPoints(total._sum.points ?? 0, parsed.data.points)) throw new Error("TOTAL_POINTS_EXCEEDED");
      const question = await transaction.quizQuestion.create({
        data: {
          organizationId,
          createdById: user.id,
          type: parsed.data.type,
          prompt: parsed.data.prompt,
          description: parsed.data.description ?? null,
          points: parsed.data.points,
          required: parsed.data.required,
          difficulty: parsed.data.difficulty,
          tags: parseQuizTags(parsed.data.tags),
          explanation: parsed.data.explanation ?? null,
          caseSensitive: parsed.data.caseSensitive,
          trimWhitespace: parsed.data.trimWhitespace,
          choices: choices.length ? { createMany: { data: choices.map((choice, position) => ({ ...choice, position })) } } : undefined,
          acceptedAnswers: digests.length ? { createMany: { data: digests.map((digest) => ({ digest })) } } : undefined,
          placements: { create: { quizId: quiz.assignmentItemId, position: (maximum._max.position ?? -1) + 1 } },
        },
        select: { id: true },
      });
      await transaction.auditLog.create({ data: { actorId: user.id, organizationId, action: "QUIZ_QUESTION_CREATED", targetType: "QUIZ_QUESTION", targetId: question.id, metadata: { quizId: quiz.assignmentItemId, type: parsed.data.type, points: parsed.data.points } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    redirect(`${quizPath(organizationId, assignmentId, parsed.data.quizId)}?error=create_failed`);
  }
  redirect(`${quizPath(organizationId, assignmentId, parsed.data.quizId)}?success=question_created`);
}

export async function reuseQuizQuestion(formData: FormData) {
  const parsed = reuseQuizQuestionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?quiz_error=invalid_input");
  const { organizationId, assignmentId, quizId, questionId } = parsed.data;
  const { user } = await requireOrganizationAccess(organizationId, true);
  try {
    await prisma.$transaction(async (transaction) => {
      const membership = await transaction.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: user.id } } });
      if (!canManageOrganization({ systemRole: user.systemRole, membership })) throw new Error("FORBIDDEN");
      const [quiz, question, maximum, total] = await Promise.all([
        transaction.quiz.findFirst({ where: { assignmentItemId: quizId, assignmentItem: { assignmentId, assignment: { organizationId, archivedAt: null } } }, select: { assignmentItemId: true } }),
        transaction.quizQuestion.findFirst({ where: { id: questionId, organizationId }, select: { id: true, points: true } }),
        transaction.quizQuestionPlacement.aggregate({ where: { quizId }, _max: { position: true } }),
        transaction.quizQuestion.aggregate({ where: { placements: { some: { quizId } } }, _sum: { points: true } }),
      ]);
      if (!quiz || !question) throw new Error("NOT_FOUND");
      if (!canAddQuizPoints(total._sum.points ?? 0, question.points)) throw new Error("TOTAL_POINTS_EXCEEDED");
      await transaction.quizQuestionPlacement.create({ data: { quizId, questionId, position: (maximum._max.position ?? -1) + 1 } });
      await transaction.auditLog.create({ data: { actorId: user.id, organizationId, action: "QUIZ_BANK_QUESTION_REUSED", targetType: "QUIZ_QUESTION", targetId: questionId, metadata: { quizId } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    redirect(`${quizPath(organizationId, assignmentId, quizId)}?error=reuse_failed`);
  }
  redirect(`${quizPath(organizationId, assignmentId, quizId)}?success=question_reused`);
}
