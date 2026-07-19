import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/features/auth/guards";
import { canViewQuestion } from "@/features/question/policy";
import { downloadQuestionAttachment } from "@/features/question/storage";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  const id = z.uuid().safeParse((await params).attachmentId);
  if (!id.success) notFound();
  const user = await requireAuthenticatedUser();
  const attachment = await prisma.questionAttachment.findUnique({ where: { id: id.data }, include: { question: true, answer: { include: { question: true } } } });
  const question = attachment?.question ?? attachment?.answer?.question;
  if (!attachment || !question || question.hiddenAt) notFound();
  const membership = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: question.organizationId, userId: user.id } } });
  if (!canViewQuestion(question.boardType, { userId: user.id, systemRole: user.systemRole, membership, authorId: question.authorId, assignedMentorId: question.assignedMentorId })) notFound();
  try {
    const blob = await downloadQuestionAttachment(attachment.storagePath);
    return new Response(blob, { headers: { "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename="question-attachment"; filename*=UTF-8''${encodeURIComponent(attachment.originalFilename)}`, "Content-Length": String(attachment.sizeBytes), "Content-Type": attachment.mimeType, "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("파일을 불러올 수 없습니다.", { status: 502 }); }
}
