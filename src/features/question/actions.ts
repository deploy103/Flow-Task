"use server";

import { randomUUID } from "node:crypto";
import { MembershipRole, MembershipStatus, MentoringRole, MentorRelationType, NotificationType, Prisma, QuestionBoardType, QuestionStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization } from "@/features/organization/permissions";
import { prisma } from "@/lib/prisma";
import { canAnswerQuestion, canCreateQuestion, canEditQuestion, canSetQuestionStatus } from "./policy";
import { canAssignMentorRelation } from "./mentor-relation";
import { requireQuestionAccess } from "./queries";
import { acceptAnswerSchema, answerSchema, assignQuestionMentorSchema, createQuestionSchema, deleteQuestionSchema, mentorRelationReferenceSchema, mentorRelationSchema, statusSchema, updateQuestionSchema } from "./schemas";
import { questionStoragePath, removeQuestionAttachment, uploadQuestionAttachment, validateQuestionAttachment } from "./storage";

const path = (organizationId: string, questionId?: string) => `/organizations/${organizationId}/questions${questionId ? `/${questionId}` : ""}`;

export async function createQuestion(formData: FormData) {
  const parsed = createQuestionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?error=invalid_question");
  const { user, membership } = await requireOrganizationAccess(parsed.data.organizationId);
  const primary = await prisma.mentorRelation.findFirst({ where: { organizationId: parsed.data.organizationId, menteeId: user.id, type: MentorRelationType.PRIMARY, endedAt: null }, select: { mentorId: true } });
  if (!canCreateQuestion(parsed.data.boardType, { userId: user.id, systemRole: user.systemRole, membership }, Boolean(primary))) redirect(`${path(parsed.data.organizationId)}/new?error=forbidden`);
  if (parsed.data.relatedAssignmentId) {
    const manage = canManageOrganization({ systemRole: user.systemRole, membership });
    const assignment = await prisma.assignment.findFirst({ where: { id: parsed.data.relatedAssignmentId, organizationId: parsed.data.organizationId, archivedAt: null, ...(manage ? {} : { opensAt: { lte: new Date() }, OR: [{ audience: "ALL_MEMBERS" }, { targets: { some: { userId: user.id } } }] }) }, select: { id: true } });
    if (!assignment) redirect(`${path(parsed.data.organizationId)}/new?error=invalid_assignment`);
  }
  let attachment;
  try { attachment = await validateQuestionAttachment(formData.get("attachment")); } catch { redirect(`${path(parsed.data.organizationId)}/new?error=invalid_attachment`); }
  const questionId = randomUUID();
  const storagePath = attachment ? questionStoragePath(parsed.data.organizationId, user.id, attachment.metadata.extension) : null;
  if (attachment && storagePath) {
    try { await uploadQuestionAttachment(storagePath, attachment.file); } catch { redirect(`${path(parsed.data.organizationId)}/new?error=upload_failed`); }
  }
  try {
    await prisma.$transaction(async (tx) => {
      const assignedMentorId = parsed.data.boardType === QuestionBoardType.PRIVATE_MENTOR ? primary?.mentorId : null;
      await tx.question.create({ data: { id: questionId, organizationId: parsed.data.organizationId, authorId: user.id, assignedMentorId, relatedAssignmentId: parsed.data.relatedAssignmentId || null, boardType: parsed.data.boardType, category: parsed.data.category, title: parsed.data.title, content: parsed.data.content, attempted: parsed.data.attempted || null, errorMessage: parsed.data.errorMessage || null, code: parsed.data.code || null, attachments: attachment && storagePath ? { create: { storagePath, originalFilename: attachment.metadata.originalFilename, mimeType: attachment.metadata.mimeType, sizeBytes: attachment.metadata.sizeBytes } } : undefined } });
      const recipientIds = parsed.data.boardType === QuestionBoardType.PRIVATE_MENTOR && assignedMentorId ? [assignedMentorId] : (await tx.organizationMember.findMany({ where: { organizationId: parsed.data.organizationId, status: MembershipStatus.ACTIVE, ...(parsed.data.boardType === QuestionBoardType.MENTOR_QNA ? { OR: [{ mentoringRole: MentoringRole.MENTOR }, { role: MembershipRole.ORG_ADMIN }] } : {}) }, select: { userId: true } })).map(({ userId }) => userId).filter((id) => id !== user.id);
      if (recipientIds.length) await tx.notification.createMany({ data: recipientIds.map((userId) => ({ userId, organizationId: parsed.data.organizationId, type: NotificationType.QUESTION_CREATED, title: "새 질문이 등록되었습니다", body: parsed.data.title, href: path(parsed.data.organizationId, questionId), dedupeKey: `question:${questionId}:created` })), skipDuplicates: true });
      await tx.auditLog.create({ data: { actorId: user.id, organizationId: parsed.data.organizationId, action: "QUESTION_CREATED", targetType: "QUESTION", targetId: questionId, metadata: { boardType: parsed.data.boardType } } });
    });
  } catch { if (storagePath) await removeQuestionAttachment(storagePath).catch(() => undefined); redirect(`${path(parsed.data.organizationId)}/new?error=create_failed`); }
  redirect(path(parsed.data.organizationId, questionId));
}

export async function createQuestionAnswer(formData: FormData) {
  const parsed = answerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?error=invalid_answer");
  const { user, membership, question } = await requireQuestionAccess(parsed.data.organizationId, parsed.data.questionId);
  if (!canAnswerQuestion(question.boardType, { userId: user.id, systemRole: user.systemRole, membership, authorId: question.authorId, assignedMentorId: question.assignedMentorId })) redirect(`${path(parsed.data.organizationId, question.id)}?error=forbidden`);
  if (parsed.data.parentId && !(await prisma.questionAnswer.findFirst({ where: { id: parsed.data.parentId, questionId: question.id, hiddenAt: null } }))) redirect(`${path(parsed.data.organizationId, question.id)}?error=invalid_parent`);
  let attachment;
  try { attachment = await validateQuestionAttachment(formData.get("attachment")); } catch { redirect(`${path(parsed.data.organizationId, question.id)}?error=invalid_attachment`); }
  const answerId = randomUUID();
  const storagePath = attachment ? questionStoragePath(parsed.data.organizationId, user.id, attachment.metadata.extension) : null;
  if (attachment && storagePath) { try { await uploadQuestionAttachment(storagePath, attachment.file); } catch { redirect(`${path(parsed.data.organizationId, question.id)}?error=upload_failed`); } }
  let answer;
  try { answer = await prisma.$transaction(async (tx) => {
    const created = await tx.questionAnswer.create({ data: { id: answerId, questionId: question.id, authorId: user.id, parentId: parsed.data.parentId || null, content: parsed.data.content, code: parsed.data.code || null, attachments: attachment && storagePath ? { create: { storagePath, originalFilename: attachment.metadata.originalFilename, mimeType: attachment.metadata.mimeType, sizeBytes: attachment.metadata.sizeBytes } } : undefined } });
    if (question.status === QuestionStatus.WAITING || (!question.assignedMentorId && membership?.mentoringRole === MentoringRole.MENTOR)) await tx.question.update({ where: { id: question.id }, data: { ...(question.status === QuestionStatus.WAITING ? { status: QuestionStatus.IN_PROGRESS } : {}), ...(!question.assignedMentorId && membership?.mentoringRole === MentoringRole.MENTOR ? { assignedMentorId: user.id } : {}) } });
    const recipientId = user.id === question.authorId ? question.assignedMentorId : question.authorId;
    if (recipientId && recipientId !== user.id) await tx.notification.create({ data: { userId: recipientId, organizationId: parsed.data.organizationId, type: NotificationType.QUESTION_ANSWERED, title: "질문에 새 답변이 등록되었습니다", body: question.title, href: path(parsed.data.organizationId, question.id), dedupeKey: `question-answer:${created.id}` } });
    await tx.auditLog.create({ data: { actorId: user.id, organizationId: parsed.data.organizationId, action: "QUESTION_ANSWER_CREATED", targetType: "QUESTION_ANSWER", targetId: created.id, metadata: { questionId: question.id } } });
    return created;
  }); } catch { if (storagePath) await removeQuestionAttachment(storagePath).catch(() => undefined); redirect(`${path(parsed.data.organizationId, question.id)}?error=answer_failed`); }
  redirect(`${path(parsed.data.organizationId, question.id)}#answer-${answer.id}`);
}

export async function updateQuestion(formData: FormData) {
  const parsed = updateQuestionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?error=invalid_question");
  const { user, membership, question } = await requireQuestionAccess(parsed.data.organizationId, parsed.data.questionId);
  const context = { userId: user.id, systemRole: user.systemRole, membership, authorId: question.authorId };
  if (!canEditQuestion(context)) redirect(`${path(parsed.data.organizationId, question.id)}?error=forbidden`);
  if (parsed.data.relatedAssignmentId) {
    const canManage = canManageOrganization({ systemRole: user.systemRole, membership });
    const assignment = await prisma.assignment.findFirst({
      where: {
        id: parsed.data.relatedAssignmentId,
        organizationId: parsed.data.organizationId,
        archivedAt: null,
        ...(canManage ? {} : { opensAt: { lte: new Date() }, OR: [{ audience: "ALL_MEMBERS" }, { targets: { some: { userId: user.id } } }] }),
      },
      select: { id: true },
    });
    if (!assignment) redirect(`${path(parsed.data.organizationId, question.id)}/edit?error=invalid_assignment`);
  }
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.question.updateMany({
      where: { id: question.id, organizationId: parsed.data.organizationId, hiddenAt: null },
      data: {
        category: parsed.data.category,
        title: parsed.data.title,
        content: parsed.data.content,
        attempted: parsed.data.attempted || null,
        errorMessage: parsed.data.errorMessage || null,
        code: parsed.data.code || null,
        relatedAssignmentId: parsed.data.relatedAssignmentId || null,
      },
    });
    if (result.count !== 1) return false;
    await tx.auditLog.create({ data: { actorId: user.id, organizationId: parsed.data.organizationId, action: "QUESTION_UPDATED", targetType: "QUESTION", targetId: question.id } });
    return true;
  });
  if (!updated) redirect(`${path(parsed.data.organizationId)}?error=not_found`);
  redirect(`${path(parsed.data.organizationId, question.id)}?message=updated`);
}

export async function deleteQuestion(formData: FormData) {
  const parsed = deleteQuestionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?error=invalid_question");
  const { user, membership, question } = await requireQuestionAccess(parsed.data.organizationId, parsed.data.questionId);
  const context = { userId: user.id, systemRole: user.systemRole, membership, authorId: question.authorId };
  if (!canEditQuestion(context)) redirect(`${path(parsed.data.organizationId, question.id)}?error=forbidden`);
  if (parsed.data.confirmationTitle !== question.title) redirect(`${path(parsed.data.organizationId, question.id)}/edit?error=confirmation_mismatch`);
  const hidden = await prisma.$transaction(async (tx) => {
    const result = await tx.question.updateMany({
      where: { id: question.id, organizationId: parsed.data.organizationId, hiddenAt: null },
      data: { hiddenAt: new Date(), closedAt: new Date(), status: QuestionStatus.CLOSED },
    });
    if (result.count !== 1) return false;
    await tx.auditLog.create({ data: { actorId: user.id, organizationId: parsed.data.organizationId, action: "QUESTION_HIDDEN", targetType: "QUESTION", targetId: question.id } });
    return true;
  });
  if (!hidden) redirect(`${path(parsed.data.organizationId)}?error=not_found`);
  redirect(`${path(parsed.data.organizationId)}?message=deleted`);
}

export async function changeQuestionStatus(formData: FormData) {
  const parsed = statusSchema.safeParse(Object.fromEntries(formData)); if (!parsed.success) redirect("/dashboard?error=invalid_status");
  const { user, membership, question } = await requireQuestionAccess(parsed.data.organizationId, parsed.data.questionId);
  if (!canSetQuestionStatus(question.boardType, parsed.data.status, { userId: user.id, systemRole: user.systemRole, membership, authorId: question.authorId, assignedMentorId: question.assignedMentorId })) redirect(`${path(parsed.data.organizationId, question.id)}?error=forbidden`);
  await prisma.$transaction(async (tx) => {
    await tx.question.update({ where: { id: question.id }, data: { status: parsed.data.status, closedAt: parsed.data.status === QuestionStatus.CLOSED ? new Date() : null } });
    await tx.auditLog.create({ data: { actorId: user.id, organizationId: parsed.data.organizationId, action: "QUESTION_STATUS_CHANGED", targetType: "QUESTION", targetId: question.id, metadata: { status: parsed.data.status } } });
    if (parsed.data.status === QuestionStatus.NEEDS_INFO && question.authorId !== user.id) await tx.notification.createMany({ data: [{ userId: question.authorId, organizationId: parsed.data.organizationId, type: NotificationType.QUESTION_ANSWERED, title: "질문에 추가 정보가 필요합니다", body: question.title, href: path(parsed.data.organizationId, question.id), dedupeKey: `question:${question.id}:needs-info:${question.updatedAt.toISOString()}` }], skipDuplicates: true });
  });
  redirect(`${path(parsed.data.organizationId, question.id)}?message=status_updated`);
}

export async function acceptQuestionAnswer(formData: FormData) {
  const parsed = acceptAnswerSchema.safeParse(Object.fromEntries(formData)); if (!parsed.success) redirect("/dashboard?error=invalid_answer");
  const { user, question } = await requireQuestionAccess(parsed.data.organizationId, parsed.data.questionId);
  if (question.authorId !== user.id) redirect(`${path(parsed.data.organizationId, question.id)}?error=forbidden`);
  await prisma.$transaction(async (tx) => { const answer = await tx.questionAnswer.findFirst({ where: { id: parsed.data.answerId, questionId: question.id, hiddenAt: null } }); if (!answer) throw new Error("ANSWER_NOT_FOUND"); await tx.questionAnswer.updateMany({ where: { questionId: question.id, isAccepted: true }, data: { isAccepted: false } }); await tx.questionAnswer.update({ where: { id: answer.id }, data: { isAccepted: true } }); await tx.question.update({ where: { id: question.id }, data: { status: QuestionStatus.RESOLVED } }); await tx.auditLog.create({ data: { actorId: user.id, organizationId: parsed.data.organizationId, action: "QUESTION_ANSWER_ACCEPTED", targetType: "QUESTION_ANSWER", targetId: answer.id, metadata: { questionId: question.id } } }); if (answer.authorId !== user.id) await tx.notification.createMany({ data: [{ userId: answer.authorId, organizationId: parsed.data.organizationId, type: NotificationType.ANSWER_ACCEPTED, title: "답변이 해결 답변으로 채택되었습니다", body: question.title, href: path(parsed.data.organizationId, question.id), dedupeKey: `answer:${answer.id}:accepted` }], skipDuplicates: true }); }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  redirect(`${path(parsed.data.organizationId, question.id)}?message=accepted`);
}

export async function assignMentorRelation(formData: FormData) {
  const parsed = mentorRelationSchema.safeParse(Object.fromEntries(formData)); if (!parsed.success) redirect("/dashboard?error=invalid_relation");
  const { user } = await requireOrganizationAccess(parsed.data.organizationId, true);
  const members = await prisma.organizationMember.findMany({ where: { organizationId: parsed.data.organizationId, userId: { in: [parsed.data.mentorId, parsed.data.menteeId] } }, select: { userId: true, mentoringRole: true, securityTrack: true, status: true } });
  const mentor = members.find(({ userId }) => userId === parsed.data.mentorId);
  const mentee = members.find(({ userId }) => userId === parsed.data.menteeId);
  if (!canAssignMentorRelation(mentor, mentee)) redirect(`${path(parsed.data.organizationId)}/mentors?error=invalid_members`);
  try {
    await prisma.$transaction(async (tx) => { if (parsed.data.type === MentorRelationType.PRIMARY) await tx.mentorRelation.updateMany({ where: { organizationId: parsed.data.organizationId, menteeId: parsed.data.menteeId, type: MentorRelationType.PRIMARY, endedAt: null }, data: { type: MentorRelationType.SECONDARY } }); await tx.mentorRelation.upsert({ where: { organizationId_mentorId_menteeId: { organizationId: parsed.data.organizationId, mentorId: parsed.data.mentorId, menteeId: parsed.data.menteeId } }, create: parsed.data, update: { type: parsed.data.type, endedAt: null } }); await tx.auditLog.create({ data: { actorId: user.id, organizationId: parsed.data.organizationId, action: "MENTOR_RELATION_ASSIGNED", targetType: "USER", targetId: parsed.data.menteeId, metadata: { mentorId: parsed.data.mentorId, type: parsed.data.type } } }); }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (parsed.data.type === MentorRelationType.PRIMARY && error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) redirect(`${path(parsed.data.organizationId)}/mentors?error=primary_conflict`);
    throw error;
  }
  redirect(`${path(parsed.data.organizationId)}/mentors?message=assigned`);
}

export async function endMentorRelation(formData: FormData) {
  const parsed = mentorRelationReferenceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?error=invalid_relation");
  const { user } = await requireOrganizationAccess(parsed.data.organizationId, true);
  const ended = await prisma.$transaction(async (tx) => {
    const result = await tx.mentorRelation.updateMany({
      where: { id: parsed.data.relationId, organizationId: parsed.data.organizationId, endedAt: null },
      data: { endedAt: new Date() },
    });
    if (result.count !== 1) return false;
    await tx.auditLog.create({ data: { actorId: user.id, organizationId: parsed.data.organizationId, action: "MENTOR_RELATION_ENDED", targetType: "MENTOR_RELATION", targetId: parsed.data.relationId } });
    return true;
  });
  redirect(`${path(parsed.data.organizationId)}/mentors?${ended ? "message=ended" : "error=not_found"}`);
}

export async function assignQuestionMentor(formData: FormData) {
  const parsed = assignQuestionMentorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?error=invalid_assignment");
  const { user } = await requireOrganizationAccess(parsed.data.organizationId, true);
  const [question, mentor] = await Promise.all([
    prisma.question.findFirst({ where: { id: parsed.data.questionId, organizationId: parsed.data.organizationId, boardType: QuestionBoardType.MENTOR_QNA, hiddenAt: null }, select: { id: true, title: true } }),
    prisma.organizationMember.findFirst({ where: { organizationId: parsed.data.organizationId, userId: parsed.data.mentorId, status: MembershipStatus.ACTIVE, mentoringRole: MentoringRole.MENTOR }, select: { userId: true } }),
  ]);
  if (!question || !mentor) redirect(`${path(parsed.data.organizationId, parsed.data.questionId)}?error=invalid_mentor`);
  await prisma.$transaction(async (tx) => {
    await tx.question.update({ where: { id: question.id }, data: { assignedMentorId: mentor.userId } });
    await tx.notification.createMany({ data: [{ userId: mentor.userId, organizationId: parsed.data.organizationId, type: NotificationType.QUESTION_ASSIGNED, title: "질문 담당자로 지정되었습니다", body: question.title, href: path(parsed.data.organizationId, question.id), dedupeKey: `question:${question.id}:assigned:${mentor.userId}` }], skipDuplicates: true });
    await tx.auditLog.create({ data: { actorId: user.id, organizationId: parsed.data.organizationId, action: "QUESTION_MENTOR_ASSIGNED", targetType: "QUESTION", targetId: question.id, metadata: { mentorId: mentor.userId } } });
  });
  redirect(`${path(parsed.data.organizationId, question.id)}?message=mentor_assigned`);
}
