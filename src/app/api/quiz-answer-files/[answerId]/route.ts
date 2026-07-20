import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/features/auth/guards";
import { canReviewSubmissions } from "@/features/organization/permissions";
import { canDownloadQuizAnswerFile } from "@/features/quiz/file-access";
import { downloadQuizFile } from "@/features/quiz/storage";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ answerId: string }> }) {
  const id = z.uuid().safeParse((await params).answerId);
  if (!id.success) notFound();
  const user = await requireAuthenticatedUser();
  const file = await prisma.quizAnswerFile.findUnique({ where: { answerId: id.data }, select: { storagePath: true, originalFilename: true, mimeType: true, sizeBytes: true, answer: { select: { attempt: { select: { userId: true, quiz: { select: { assignmentItem: { select: { assignment: { select: { organizationId: true, archivedAt: true } } } } } } } } } } } });
  if (!file) notFound();
  const assignment = file.answer.attempt.quiz.assignmentItem.assignment;
  const membership = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: assignment.organizationId, userId: user.id } } });
  const canReview = canReviewSubmissions({ systemRole: user.systemRole, membership });
  if (!canDownloadQuizAnswerFile({ userId: user.id, ownerId: file.answer.attempt.userId, systemRole: user.systemRole, membershipStatus: membership?.status, canReview, archivedAt: assignment.archivedAt })) notFound();
  try { const blob = await downloadQuizFile(file.storagePath); return new Response(blob, { headers: { "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename="quiz-answer"; filename*=UTF-8''${encodeURIComponent(file.originalFilename)}`, "Content-Length": String(file.sizeBytes), "Content-Type": file.mimeType, "X-Content-Type-Options": "nosniff" } }); }
  catch { return new Response("파일을 불러올 수 없습니다.", { status: 502 }); }
}
