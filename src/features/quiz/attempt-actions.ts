"use server";

import { randomInt } from "node:crypto";
import { MembershipStatus, Prisma, QuizAttemptStatus, QuizQuestionType } from "@prisma/client";
import { redirect } from "next/navigation";
import { canSubmitAssignment } from "@/features/submission/access";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canReviewSubmissions } from "@/features/organization/permissions";
import { prisma } from "@/lib/prisma";
import { matchesQuizAnswer } from "./answer-hash";
import { getQuizAttemptState, isQuizAttemptExpired, shuffleValues } from "./attempt-policy";
import { scoreChoiceAnswer } from "./grading";
import { attemptContextSchema, gradeQuizAnswerSchema, startQuizSchema } from "./schemas";
import { quizFilePath, removeQuizFile, uploadQuizFile, validateQuizFile } from "./storage";

const attemptPath = (organizationId: string, assignmentId: string, quizId: string, attemptId?: string) =>
  `/organizations/${organizationId}/assignments/${assignmentId}/quiz/${quizId}${attemptId ? `/attempts/${attemptId}` : ""}`;
const MANUAL_TYPES: QuizQuestionType[] = [QuizQuestionType.LONG_TEXT, QuizQuestionType.FILE];
const random = () => randomInt(0, 1_000_000) / 1_000_000;
const stringArray = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

async function assertWritableAttempt(transaction: Prisma.TransactionClient, input: { organizationId: string; assignmentId: string; quizId: string; attemptId: string; questionId: string; userId: string }) {
  await transaction.$queryRaw`SELECT "id" FROM "quiz_attempts" WHERE "id" = ${input.attemptId}::uuid FOR UPDATE`;
  const attempt = await transaction.quizAttempt.findFirst({
    where: { id: input.attemptId, quizId: input.quizId, userId: input.userId, status: QuizAttemptStatus.IN_PROGRESS, quiz: { assignmentItem: { assignmentId: input.assignmentId, assignment: { organizationId: input.organizationId, archivedAt: null } } } },
    select: { expiresAt: true, questionOrder: true, quiz: { select: { assignmentItem: { select: { assignment: { select: { audience: true, opensAt: true, deadline: true, allowLate: true, targets: { where: { userId: input.userId }, select: { userId: true } } } } } } } } },
  });
  if (!attempt || isQuizAttemptExpired(attempt.expiresAt) || !stringArray(attempt.questionOrder).includes(input.questionId)) throw new Error("ATTEMPT_CLOSED");
  const membership = await transaction.organizationMember.findFirst({ where: { organizationId: input.organizationId, userId: input.userId, status: MembershipStatus.ACTIVE }, select: { status: true } });
  const assignment = attempt.quiz.assignmentItem.assignment;
  const canSubmit = canSubmitAssignment({ audience: assignment.audience, targetUserIds: assignment.targets.map(({ userId }) => userId), userId: input.userId, membershipStatus: membership?.status });
  const now = new Date();
  if (!canSubmit || now < assignment.opensAt || (now > assignment.deadline && !assignment.allowLate)) throw new Error("FORBIDDEN");
}

export async function startQuizAttempt(formData: FormData) {
  const parsed = startQuizSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?quiz_error=invalid_input");
  const { organizationId, assignmentId, quizId } = parsed.data;
  const { user } = await requireOrganizationAccess(organizationId);
  let result: { id: string } | { error: string };
  try {
    result = await prisma.$transaction(async (transaction) => {
      const quiz = await transaction.quiz.findFirst({
        where: { assignmentItemId: quizId, assignmentItem: { assignmentId, assignment: { organizationId, archivedAt: null } } },
        select: {
          assignmentItemId: true, timeLimitMinutes: true, attemptLimit: true, passingScore: true, shuffleQuestions: true, shuffleChoices: true,
          assignmentItem: { select: { assignment: { select: { audience: true, opensAt: true, deadline: true, allowLate: true, targets: { where: { userId: user.id }, select: { userId: true } } } } } },
          questions: { orderBy: { position: "asc" }, select: { question: { select: { id: true, type: true, points: true, choices: { orderBy: { position: "asc" }, select: { id: true } } } } } },
        },
      });
      if (!quiz || !quiz.questions.length) return { error: "not_ready" } as const;
      const membership = await transaction.organizationMember.findFirst({ where: { organizationId, userId: user.id, status: MembershipStatus.ACTIVE }, select: { status: true } });
      const assignment = quiz.assignmentItem.assignment;
      const canSubmit = canSubmitAssignment({ audience: assignment.audience, targetUserIds: assignment.targets.map(({ userId }) => userId), userId: user.id, membershipStatus: membership?.status });
      const attempts = await transaction.quizAttempt.findMany({ where: { quizId, userId: user.id }, orderBy: { attemptNumber: "desc" }, select: { id: true, attemptNumber: true, status: true, expiresAt: true, answers: { select: { score: true, question: { select: { type: true } } } } } });
      const now = new Date();
      for (const expired of attempts.filter((attempt) => attempt.status === QuizAttemptStatus.IN_PROGRESS && isQuizAttemptExpired(attempt.expiresAt, now))) {
        const manualPending = expired.answers.some((answer) => MANUAL_TYPES.includes(answer.question.type) && answer.score === null);
        const score = expired.answers.reduce((total, answer) => total + (answer.score ?? 0), 0);
        const status = manualPending ? QuizAttemptStatus.AUTO_SUBMITTED : QuizAttemptStatus.GRADED;
        await transaction.quizAttempt.update({ where: { id: expired.id }, data: { status, submittedAt: now, autoSubmitted: true, score, passed: status === QuizAttemptStatus.GRADED && quiz.passingScore !== null ? score >= quiz.passingScore : null } });
      }
      const active = attempts.find(({ status, expiresAt }) => status === QuizAttemptStatus.IN_PROGRESS && !isQuizAttemptExpired(expiresAt));
      if (active) return { id: active.id } as const;
      const access = getQuizAttemptState({ canSubmit, opensAt: assignment.opensAt, deadline: assignment.deadline, allowLate: assignment.allowLate, attemptsUsed: attempts.length, attemptLimit: quiz.attemptLimit });
      if (access !== "ALLOWED") return { error: access.toLowerCase() } as const;
      const timeExpiry = quiz.timeLimitMinutes ? new Date(now.getTime() + quiz.timeLimitMinutes * 60_000) : null;
      const expiresAt = !assignment.allowLate && timeExpiry ? new Date(Math.min(timeExpiry.getTime(), assignment.deadline.getTime())) : (!assignment.allowLate ? assignment.deadline : timeExpiry);
      const orderedQuestions = quiz.shuffleQuestions ? shuffleValues(quiz.questions, random) : quiz.questions;
      const choiceOrder = Object.fromEntries(quiz.questions.map(({ question }) => [question.id, (quiz.shuffleChoices ? shuffleValues(question.choices, random) : question.choices).map(({ id }) => id)]));
      const attempt = await transaction.quizAttempt.create({ data: { quizId, userId: user.id, attemptNumber: (attempts[0]?.attemptNumber ?? 0) + 1, expiresAt, maxScore: quiz.questions.reduce((total, { question }) => total + question.points, 0), questionOrder: orderedQuestions.map(({ question }) => question.id), choiceOrder }, select: { id: true } });
      await transaction.auditLog.create({ data: { actorId: user.id, organizationId, action: "QUIZ_ATTEMPT_STARTED", targetType: "QUIZ_ATTEMPT", targetId: attempt.id, metadata: { quizId, attemptNumber: (attempts[0]?.attemptNumber ?? 0) + 1 } } });
      return attempt;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch { result = { error: "start_failed" }; }
  if ("error" in result) redirect(`${attemptPath(organizationId, assignmentId, quizId)}?error=${result.error}`);
  redirect(attemptPath(organizationId, assignmentId, quizId, result.id));
}

export type QuizSaveState = { status: "idle" | "saved" | "error"; message?: string; savedAt?: string };

export async function saveQuizAnswer(_previous: QuizSaveState, formData: FormData): Promise<QuizSaveState> {
  const context = attemptContextSchema.safeParse(Object.fromEntries(formData));
  const questionId = formData.get("questionId");
  if (!context.success || typeof questionId !== "string") return { status: "error", message: "invalid_input" };
  const { organizationId, assignmentId, quizId, attemptId } = context.data;
  const { user } = await requireOrganizationAccess(organizationId);
  const selectedChoiceIds = formData.getAll("selectedChoiceIds").filter((value): value is string => typeof value === "string");
  const value = typeof formData.get("value") === "string" ? String(formData.get("value")) : "";
  if (value.length > 50_000) return { status: "error", message: "invalid_input" };
  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, quizId, userId: user.id, quiz: { assignmentItem: { assignmentId, assignment: { organizationId, archivedAt: null } } } },
    select: {
      status: true, expiresAt: true, questionOrder: true,
      quiz: { select: { assignmentItem: { select: { assignment: { select: { audience: true, opensAt: true, deadline: true, allowLate: true, targets: { where: { userId: user.id }, select: { userId: true } } } } } } } },
    },
  });
  if (!attempt || attempt.status !== QuizAttemptStatus.IN_PROGRESS || isQuizAttemptExpired(attempt.expiresAt)) return { status: "error", message: "attempt_closed" };
  if (!stringArray(attempt.questionOrder).includes(questionId)) return { status: "error", message: "question_not_found" };
  const membership = await prisma.organizationMember.findFirst({ where: { organizationId, userId: user.id, status: MembershipStatus.ACTIVE }, select: { status: true } });
  const assignment = attempt.quiz.assignmentItem.assignment;
  const canSubmit = canSubmitAssignment({ audience: assignment.audience, targetUserIds: assignment.targets.map(({ userId }) => userId), userId: user.id, membershipStatus: membership?.status });
  if (!canSubmit || new Date() < assignment.opensAt || (new Date() > assignment.deadline && !assignment.allowLate)) return { status: "error", message: "forbidden" };
  const question = await prisma.quizQuestion.findFirst({
    where: { id: questionId, organizationId, placements: { some: { quizId } } },
    select: { id: true, type: true, points: true, required: true, caseSensitive: true, trimWhitespace: true, choices: { select: { id: true, isCorrect: true } }, acceptedAnswers: { select: { digest: true } } },
  });
  if (!question) return { status: "error", message: "question_not_found" };

  const writableInput = { organizationId, assignmentId, quizId, attemptId, questionId, userId: user.id };
  const clearAnswer = async () => {
    await prisma.$transaction(async (transaction) => {
      await assertWritableAttempt(transaction, writableInput);
      await transaction.quizAnswer.deleteMany({ where: { attemptId, questionId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { status: "saved", savedAt: new Date().toISOString() } as const;
  };

  let response: Prisma.InputJsonValue;
  let score: number | null;
  if (question.type === QuizQuestionType.SINGLE_CHOICE || question.type === QuizQuestionType.MULTIPLE_CHOICE) {
    if (!selectedChoiceIds.length) {
      try { return await clearAnswer(); } catch { return { status: "error", message: "save_failed" }; }
    }
    const resolved = scoreChoiceAnswer({ type: question.type, selectedChoiceIds, choices: question.choices, points: question.points });
    if (resolved === null) return { status: "error", message: "invalid_choice" };
    response = { choiceIds: selectedChoiceIds };
    score = resolved;
  } else if (question.type === QuizQuestionType.SHORT_TEXT || question.type === QuizQuestionType.FLAG) {
    if (!value.trim()) {
      try { return await clearAnswer(); } catch { return { status: "error", message: "save_failed" }; }
    }
    try { score = matchesQuizAnswer(value, question.acceptedAnswers.map(({ digest }) => digest), { caseSensitive: question.caseSensitive, trimWhitespace: question.trimWhitespace }) ? question.points : 0; }
    catch { return { status: "error", message: "save_failed" }; }
    response = question.type === QuizQuestionType.FLAG ? { provided: true } : { text: value };
  } else if (question.type === QuizQuestionType.LONG_TEXT) {
    if (!value.trim()) {
      try { return await clearAnswer(); } catch { return { status: "error", message: "save_failed" }; }
    }
    response = { text: value };
    score = null;
  } else {
    let resource;
    try { resource = await validateQuizFile(formData.get("file")); } catch { return { status: "error", message: "invalid_file" }; }
    if (!resource) return { status: "error", message: "file_required" };
    const storagePath = quizFilePath(organizationId, user.id, resource.metadata.extension);
    try { await uploadQuizFile(storagePath, resource.file); } catch { return { status: "error", message: "upload_failed" }; }
    let previousPath: string | undefined;
    try {
      previousPath = await prisma.$transaction(async (transaction) => {
        await assertWritableAttempt(transaction, writableInput);
        const existing = await transaction.quizAnswer.findUnique({ where: { attemptId_questionId: { attemptId, questionId } }, select: { file: { select: { storagePath: true } } } });
        const answer = await transaction.quizAnswer.upsert({ where: { attemptId_questionId: { attemptId, questionId } }, create: { attemptId, questionId, response: { file: true }, score: null }, update: { response: { file: true }, score: null, feedback: null, gradedById: null, gradedAt: null }, select: { id: true } });
        await transaction.quizAnswerFile.upsert({ where: { answerId: answer.id }, create: { answerId: answer.id, storagePath, originalFilename: resource.metadata.originalFilename, mimeType: resource.metadata.mimeType, sizeBytes: resource.metadata.sizeBytes }, update: { storagePath, originalFilename: resource.metadata.originalFilename, mimeType: resource.metadata.mimeType, sizeBytes: resource.metadata.sizeBytes } });
        return existing?.file?.storagePath;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch { await removeQuizFile(storagePath).catch(() => undefined); return { status: "error", message: "save_failed" }; }
    if (previousPath) await removeQuizFile(previousPath).catch(() => undefined);
    return { status: "saved", savedAt: new Date().toISOString() };
  }
  try {
    await prisma.$transaction(async (transaction) => {
      await assertWritableAttempt(transaction, writableInput);
      await transaction.quizAnswer.upsert({ where: { attemptId_questionId: { attemptId, questionId } }, create: { attemptId, questionId, response, score }, update: { response, score, feedback: null, gradedById: null, gradedAt: null } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { status: "saved", savedAt: new Date().toISOString() };
  } catch { return { status: "error", message: "save_failed" }; }
}

async function finalizeQuizAttempt(input: { organizationId: string; assignmentId: string; quizId: string; attemptId: string; userId: string; automatic: boolean }) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "quiz_attempts" WHERE "id" = ${input.attemptId}::uuid FOR UPDATE`;
    const attempt = await transaction.quizAttempt.findFirst({ where: { id: input.attemptId, quizId: input.quizId, userId: input.userId, status: QuizAttemptStatus.IN_PROGRESS, quiz: { assignmentItem: { assignmentId: input.assignmentId, assignment: { organizationId: input.organizationId, archivedAt: null } } } }, select: { id: true, quizId: true, expiresAt: true, questionOrder: true, quiz: { select: { passingScore: true, questions: { select: { question: { select: { id: true, type: true, required: true } } } } } }, answers: { select: { questionId: true, score: true } } } });
    if (!attempt) return { error: "attempt_closed" } as const;
    const expired = isQuizAttemptExpired(attempt.expiresAt);
    if (input.automatic && !expired) return { error: "not_expired" } as const;
    if (!input.automatic && expired) return { error: "attempt_expired" } as const;
    const snapshotQuestionIds = new Set(stringArray(attempt.questionOrder));
    const snapshotQuestions = attempt.quiz.questions.filter(({ question }) => snapshotQuestionIds.has(question.id));
    const answered = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
    const missingRequired = snapshotQuestions.filter(({ question }) => question.required && !answered.has(question.id));
    if (!input.automatic && missingRequired.length) return { error: "required_missing" } as const;
    const manualPending = snapshotQuestions.some(({ question }) => MANUAL_TYPES.includes(question.type) && answered.has(question.id) && answered.get(question.id)?.score === null);
    const score = attempt.answers.reduce((total, answer) => total + (answer.score ?? 0), 0);
    const status = manualPending ? (input.automatic ? QuizAttemptStatus.AUTO_SUBMITTED : QuizAttemptStatus.SUBMITTED) : QuizAttemptStatus.GRADED;
    const submittedAt = new Date();
    await transaction.quizAttempt.update({ where: { id: attempt.id }, data: { status, submittedAt, autoSubmitted: input.automatic, score, passed: status === QuizAttemptStatus.GRADED && attempt.quiz.passingScore !== null ? score >= attempt.quiz.passingScore : null } });
    await transaction.auditLog.create({ data: { actorId: input.userId, organizationId: input.organizationId, action: input.automatic ? "QUIZ_ATTEMPT_AUTO_SUBMITTED" : "QUIZ_ATTEMPT_SUBMITTED", targetType: "QUIZ_ATTEMPT", targetId: attempt.id, metadata: { quizId: attempt.quizId, status, missingRequired: missingRequired.length } } });
    return { status } as const;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function submitQuizAttempt(formData: FormData) {
  const parsed = attemptContextSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?quiz_error=invalid_input");
  const { organizationId, assignmentId, quizId, attemptId } = parsed.data;
  const { user } = await requireOrganizationAccess(organizationId);
  const automatic = formData.get("automatic") === "true";
  let result;
  try { result = await finalizeQuizAttempt({ organizationId, assignmentId, quizId, attemptId, userId: user.id, automatic }); }
  catch { redirect(`${attemptPath(organizationId, assignmentId, quizId, attemptId)}?error=submit_failed`); }
  if ("error" in result) redirect(`${attemptPath(organizationId, assignmentId, quizId, attemptId)}?error=${result.error}`);
  redirect(`${attemptPath(organizationId, assignmentId, quizId)}?success=submitted`);
}

export async function gradeQuizAnswer(formData: FormData) {
  const parsed = gradeQuizAnswerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?quiz_error=invalid_grade");
  const { organizationId, assignmentId, quizId, attemptId, answerId } = parsed.data;
  const { user, membership } = await requireOrganizationAccess(organizationId);
  if (!canReviewSubmissions({ systemRole: user.systemRole, membership })) redirect("/dashboard?quiz_error=forbidden");
  try {
    await prisma.$transaction(async (transaction) => {
      const answer = await transaction.quizAnswer.findFirst({ where: { id: answerId, attemptId, attempt: { quizId, status: { not: QuizAttemptStatus.IN_PROGRESS }, quiz: { assignmentItem: { assignmentId, assignment: { organizationId } } } }, question: { type: { in: MANUAL_TYPES } } }, select: { id: true, question: { select: { points: true } } } });
      if (!answer || parsed.data.score > answer.question.points) throw new Error("INVALID_SCORE");
      await transaction.quizAnswer.update({ where: { id: answer.id }, data: { score: parsed.data.score, feedback: parsed.data.feedback ?? null, gradedById: user.id, gradedAt: new Date() } });
      const attempt = await transaction.quizAttempt.findUnique({ where: { id: attemptId }, select: { quiz: { select: { passingScore: true } }, answers: { select: { score: true, question: { select: { type: true } } } } } });
      if (!attempt) throw new Error("NOT_FOUND");
      const pending = attempt.answers.some((item) => MANUAL_TYPES.includes(item.question.type) && item.score === null);
      if (!pending) {
        const score = attempt.answers.reduce((total, item) => total + (item.score ?? 0), 0);
        await transaction.quizAttempt.update({ where: { id: attemptId }, data: { status: QuizAttemptStatus.GRADED, score, passed: attempt.quiz.passingScore !== null ? score >= attempt.quiz.passingScore : null } });
      }
      await transaction.auditLog.create({ data: { actorId: user.id, organizationId, action: "QUIZ_ANSWER_GRADED", targetType: "QUIZ_ANSWER", targetId: answer.id, metadata: { attemptId, score: parsed.data.score } } });
    });
  } catch { redirect(`${attemptPath(organizationId, assignmentId, quizId)}/results?error=grade_failed`); }
  redirect(`${attemptPath(organizationId, assignmentId, quizId)}/results?success=graded`);
}
