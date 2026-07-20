import { AssignmentItemType } from "@prisma/client";
import { ArrowLeft, ExternalLink, Plus, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import {
  CHALLENGE_CATEGORY_LABELS,
  EXTERNAL_CHALLENGE_SOURCE_LABELS,
} from "@/constants/challenge";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization, canReviewSubmissions } from "@/features/organization/permissions";
import { normalizeSafeHttpsUrl } from "@/features/challenge/schemas";
import { formatKoreanDateTime } from "@/lib/date";
import { prisma } from "@/lib/prisma";

export default async function ChallengeStatusPage({
  params,
}: {
  params: Promise<{ organizationId: string; assignmentId: string }>;
}) {
  const { organizationId, assignmentId } = await params;
  const { user, membership } = await requireOrganizationAccess(organizationId);
  const canReview = canReviewSubmissions({ systemRole: user.systemRole, membership });
  if (!canReview) notFound();
  const canManage = canManageOrganization({ systemRole: user.systemRole, membership });

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, organizationId, archivedAt: null },
    select: {
      id: true,
      title: true,
      items: {
        where: { type: AssignmentItemType.EXTERNAL_CHALLENGE },
        orderBy: { position: "asc" },
        select: {
          id: true,
          position: true,
          externalChallenge: {
            select: {
              source: true,
              platform: true,
              title: true,
              description: true,
              problemUrl: true,
              category: true,
              difficulty: true,
              points: true,
            },
          },
          challengeGrading: {
            select: {
              flagFormat: true,
              maxAttempts: true,
              penaltyPerWrongAttempt: true,
              caseSensitive: true,
              trimWhitespace: true,
              requireWriteup: true,
              requireWriteupUrl: true,
            },
          },
          challengeSubmissions: {
            select: {
              id: true,
              attemptsCount: true,
              completedAt: true,
              score: true,
              writeup: true,
              writeupUrl: true,
              user: { select: { id: true, name: true, email: true } },
            },
            orderBy: [{ completedAt: "desc" }, { user: { name: "asc" } }],
          },
        },
      },
    },
  });
  if (!assignment) notFound();

  const challenges = assignment.items.filter(
    (item) => item.externalChallenge && item.challengeGrading,
  );

  return (
    <div className="max-w-5xl">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"
        href={`/organizations/${organizationId}/assignments/${assignmentId}`}
      >
        <ArrowLeft size={17} /> 과제로 돌아가기
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-indigo-600">외부 문제 검토</p>
          <h1 className="mt-1 text-3xl font-bold">{assignment.title} 문제 현황</h1>
          <p className="mt-2 text-slate-500">문제별 시도와 완료 결과를 확인하세요.</p>
        </div>
        {canManage && (
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 font-semibold text-white"
            href={`/organizations/${organizationId}/assignments/${assignmentId}/challenges/new`}
          >
            <Plus size={18} /> 외부 문제 추가
          </Link>
        )}
      </div>

      {challenges.length ? (
        <div className="mt-6 space-y-5">
          {challenges.map((item) => {
            const challenge = item.externalChallenge!;
            const grading = item.challengeGrading!;
            const problemUrl = normalizeSafeHttpsUrl(challenge.problemUrl);
            const completedCount = item.challengeSubmissions.filter(
              (submission) => submission.completedAt,
            ).length;
            const totalAttempts = item.challengeSubmissions.reduce(
              (total, submission) => total + submission.attemptsCount,
              0,
            );

            return (
              <Card key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                      <span>{EXTERNAL_CHALLENGE_SOURCE_LABELS[challenge.source]}</span>
                      <span>·</span>
                      <span>{challenge.platform}</span>
                      <span>·</span>
                      <span>{CHALLENGE_CATEGORY_LABELS[challenge.category]}</span>
                      <span>·</span>
                      <span>{challenge.difficulty}</span>
                    </div>
                    <h2 className="mt-2 text-xl font-bold">{challenge.title}</h2>
                  </div>
                  <strong className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
                    {challenge.points}점
                  </strong>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {challenge.description}
                </p>
                {problemUrl ? (
                  <a
                    className="mt-3 inline-flex items-center gap-1 break-all text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                    href={problemUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    문제 열기 <ExternalLink size={15} />
                  </a>
                ) : (
                  <p className="mt-3 text-sm font-semibold text-red-600">안전한 HTTPS 문제 링크가 아닙니다.</p>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                    <p className="flex items-center gap-1 text-xs text-slate-500"><Users size={14} /> 제출자</p>
                    <strong className="mt-1 block">{item.challengeSubmissions.length}명</strong>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                    <p className="flex items-center gap-1 text-xs text-slate-500"><Trophy size={14} /> 완료</p>
                    <strong className="mt-1 block text-emerald-600">{completedCount}명</strong>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                    <p className="text-xs text-slate-500">전체 시도</p>
                    <strong className="mt-1 block">{totalAttempts}회</strong>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-700">
                  최대 시도 {grading.maxAttempts ?? "무제한"}회 · 오답 감점 {grading.penaltyPerWrongAttempt}점
                  {grading.flagFormat ? ` · 플래그 형식 ${grading.flagFormat}` : ""}
                  {grading.requireWriteup ? " · 풀이 필수" : ""}
                  {grading.requireWriteupUrl ? " · 링크 필수" : ""}
                </div>

                {item.challengeSubmissions.length ? (
                  <div className="mt-5 space-y-3">
                    <h3 className="font-bold">제출 상세</h3>
                    {item.challengeSubmissions.map((submission) => {
                      const writeupUrl = submission.writeupUrl
                        ? normalizeSafeHttpsUrl(submission.writeupUrl)
                        : null;
                      return (
                        <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800" key={submission.id}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <strong>{submission.user.name}</strong>
                              <span className="ml-2 text-xs text-slate-500">{submission.user.email}</span>
                            </div>
                            <span className={submission.completedAt ? "font-semibold text-emerald-600" : "font-semibold text-slate-500"}>
                              {submission.completedAt ? "완료" : "진행 중"}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-500">
                            시도 {submission.attemptsCount}회 · 점수 {submission.score}점 · 완료 시각 {submission.completedAt ? formatKoreanDateTime(submission.completedAt) : "-"}
                          </p>
                          {submission.writeup && (
                            <div className="mt-3 text-sm">
                              <strong className="text-xs text-slate-500">풀이 내용</strong>
                              <p className="mt-1 whitespace-pre-wrap break-words leading-6">{submission.writeup}</p>
                            </div>
                          )}
                          {writeupUrl && (
                            <a
                              className="mt-3 inline-flex items-center gap-1 break-all text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                              href={writeupUrl}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              라이트업 링크 <ExternalLink size={14} />
                            </a>
                          )}
                          {submission.writeupUrl && !writeupUrl && (
                            <p className="mt-3 text-xs font-semibold text-red-600">안전하지 않은 라이트업 링크는 표시하지 않았습니다.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700">
                    아직 이 문제를 시도한 부원이 없습니다.
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="mt-6 border-dashed text-center">
          <Trophy className="mx-auto text-slate-400" />
          <p className="mt-3 font-semibold">등록된 외부 문제가 없습니다.</p>
          <p className="mt-1 text-sm text-slate-500">관리자가 문제를 추가하면 제출 현황이 여기에 표시됩니다.</p>
        </Card>
      )}
    </div>
  );
}
