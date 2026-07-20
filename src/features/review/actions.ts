"use server";

import { NotificationType, Prisma, SubmissionReviewDecision, SubmissionStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canReviewSubmissions } from "@/features/organization/permissions";
import { prisma } from "@/lib/prisma";
import { reviewContextSchema, reviewSubmissionSchema } from "./schemas";
import { getStatusForReviewDecision } from "./status";

function reviewRedirect(organizationId: string, assignmentId: string, submissionId: string, query: string): never {
  redirect(`/organizations/${organizationId}/assignments/${assignmentId}/submissions/${submissionId}?${query}`);
}

export async function reviewSubmission(formData: FormData) {
  const context = reviewContextSchema.safeParse(Object.fromEntries(formData));
  if (!context.success) redirect("/dashboard?error=invalid_review");
  const parsed = reviewSubmissionSchema.safeParse(Object.fromEntries(formData));
  const { organizationId, assignmentId, submissionId, versionId } = context.data;
  if (!parsed.success) reviewRedirect(organizationId, assignmentId, submissionId, "error=invalid_input");
  const { user, membership } = await requireOrganizationAccess(organizationId);
  if (!canReviewSubmissions({ systemRole: user.systemRole, membership })) {
    reviewRedirect(organizationId, assignmentId, submissionId, "error=forbidden");
  }

  const status = getStatusForReviewDecision(parsed.data.decision);
  try {
    await prisma.$transaction(
      async (transaction) => {
        const submission = await transaction.submission.findFirst({
          where: { id: submissionId, assignmentId, assignment: { organizationId } },
          include: { assignment: { select: { title: true } }, versions: { where: { id: versionId }, select: { id: true, version: true } } },
        });
        const version = submission?.versions[0];
        if (!submission || !version || version.version !== submission.latestVersion) {
          throw new Error("STALE_SUBMISSION_VERSION");
        }
        if (submission.status === SubmissionStatus.DRAFT) throw new Error("DRAFT_CANNOT_BE_REVIEWED");
        const review = await transaction.submissionReview.create({
          data: {
            submissionId,
            versionId,
            reviewerId: user.id,
            decision: parsed.data.decision,
            feedback: parsed.data.feedback || null,
            score: parsed.data.score,
          },
        });
        await transaction.submission.update({
          where: { id: submissionId },
          data: { status },
        });
        await transaction.submissionVersion.update({ where: { id: versionId }, data: { status } });
        await transaction.auditLog.create({
          data: {
            actorId: user.id,
            organizationId,
            action: "SUBMISSION_REVIEWED",
            targetType: "SUBMISSION",
            targetId: submissionId,
            metadata: {
              assignmentId,
              version: version.version,
              decision: parsed.data.decision,
              score: parsed.data.score ?? null,
            },
          },
        });
        if (parsed.data.decision !== SubmissionReviewDecision.REVIEWING) {
          const approved = parsed.data.decision === SubmissionReviewDecision.APPROVED;
          await transaction.notification.create({ data: {
            userId: submission.userId,
            organizationId,
            type: approved ? NotificationType.SUBMISSION_APPROVED : NotificationType.RESUBMIT_REQUIRED,
            title: approved ? "제출물이 승인되었습니다" : "재제출이 필요합니다",
            body: submission.assignment.title,
            href: `/organizations/${organizationId}/assignments/${assignmentId}`,
            dedupeKey: `submission-review:${review.id}`,
          } });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch {
    reviewRedirect(organizationId, assignmentId, submissionId, "error=review_conflict");
  }
  reviewRedirect(organizationId, assignmentId, submissionId, "success=reviewed");
}
