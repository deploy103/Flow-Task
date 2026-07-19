import { notFound } from "next/navigation";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { prisma } from "@/lib/prisma";
import { canViewQuestion } from "./policy";

export async function requireQuestionAccess(organizationId: string, questionId: string) {
  const { user, membership } = await requireOrganizationAccess(organizationId);
  const question = await prisma.question.findFirst({ where: { id: questionId, organizationId, hiddenAt: null }, include: { author: { select: { id: true, name: true } }, assignedMentor: { select: { id: true, name: true } }, relatedAssignment: { select: { id: true, title: true } }, attachments: true } });
  if (!question || !canViewQuestion(question.boardType, { userId: user.id, systemRole: user.systemRole, membership, authorId: question.authorId, assignedMentorId: question.assignedMentorId })) notFound();
  return { user, membership, question };
}
