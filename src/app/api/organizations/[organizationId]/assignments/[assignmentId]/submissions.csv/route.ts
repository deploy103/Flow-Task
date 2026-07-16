import { z } from "zod";
import { getApiUser } from "@/features/auth/api";
import { canReviewSubmissions } from "@/features/organization/permissions";
import { createCsvRow } from "@/features/review/csv";
import { getAssignmentSubmissionRoster } from "@/features/review/queries";
import { formatKoreanDateTime } from "@/lib/date";
import { prisma } from "@/lib/prisma";

const paramsSchema = z.object({ organizationId: z.uuid(), assignmentId: z.uuid() });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string; assignmentId: string }> },
) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return new Response("잘못된 요청입니다.", { status: 400 });
  const user = await getApiUser();
  if (!user) return new Response("로그인이 필요합니다.", { status: 401 });
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId: parsed.data.organizationId, userId: user.id },
    },
  });
  if (!canReviewSubmissions({ systemRole: user.systemRole, membership })) {
    return new Response("권한이 없습니다.", { status: 403 });
  }
  const data = await getAssignmentSubmissionRoster(parsed.data.organizationId, parsed.data.assignmentId);
  if (!data) return new Response("과제를 찾을 수 없습니다.", { status: 404 });
  const rows = [
    createCsvRow(["이름", "학번", "이메일", "상태", "제출 시각", "최신 버전", "점수"]),
    ...data.rows.map(({ member, submission }) =>
      createCsvRow([
        member.user.name,
        member.user.studentNumber,
        member.user.email,
        submission?.status ?? "NOT_SUBMITTED",
        submission?.submittedAt ? formatKoreanDateTime(submission.submittedAt) : null,
        submission?.latestVersion,
        submission?.reviews[0]?.score,
      ]),
    ),
  ];
  const body = `\uFEFF${rows.join("\r\n")}`;
  return new Response(body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="submission-status.csv"',
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
