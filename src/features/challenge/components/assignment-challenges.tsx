import { AssignmentItemType } from "@prisma/client";
import { ExternalLink, Flag, ListChecks, Trophy } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CHALLENGE_CATEGORY_LABELS,
  EXTERNAL_CHALLENGE_SOURCE_LABELS,
  MAX_CHALLENGE_WRITEUP_LENGTH,
} from "@/constants/challenge";
import { submitExternalChallenge } from "@/features/challenge/actions";
import {
  getChallengeAttemptAccess,
  type ChallengeAttemptAccessReason,
} from "@/features/challenge/access";
import { normalizeSafeHttpsUrl } from "@/features/challenge/schemas";
import { prisma } from "@/lib/prisma";

const ACCESS_MESSAGES: Record<Exclude<ChallengeAttemptAccessReason, "ALLOWED">, string> = {
  NOT_TARGET: "이 과제의 제출 대상이 아닙니다.",
  NOT_OPEN: "아직 문제 제출 기간이 시작되지 않았습니다.",
  CLOSED: "문제 제출 기간이 종료되었습니다.",
  COMPLETED: "완료한 문제입니다.",
  ATTEMPT_LIMIT: "최대 시도 횟수를 모두 사용했습니다.",
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "제출 내용을 다시 확인해 주세요.",
  invalid_url: "라이트업 링크는 안전한 HTTPS 주소여야 합니다.",
  flag_required: "플래그를 입력해 주세요.",
  writeup_required: "풀이 내용을 입력해 주세요.",
  writeup_url_required: "라이트업 링크를 입력해 주세요.",
  incorrect_flag: "플래그가 일치하지 않습니다.",
  not_open: "아직 문제 제출 기간이 시작되지 않았습니다.",
  closed: "문제 제출 기간이 종료되었습니다.",
  not_target: "이 과제의 제출 대상이 아닙니다.",
  already_completed: "이미 완료한 문제입니다.",
  attempt_limit: "최대 시도 횟수를 모두 사용했습니다.",
  submit_failed: "문제 결과를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  submitted: "제출 내용을 저장했습니다.",
  completed: "문제를 완료했습니다.",
};

export async function AssignmentChallenges({
  organizationId,
  assignmentId,
  userId,
  opensAt,
  deadline,
  allowLate,
  canSubmit,
  canReview,
  canManage,
  feedback,
}: {
  organizationId: string;
  assignmentId: string;
  userId: string;
  opensAt: Date;
  deadline: Date;
  allowLate: boolean;
  canSubmit: boolean;
  canReview: boolean;
  canManage: boolean;
  feedback: { error?: string; success?: string; itemId?: string };
}) {
  const items = await prisma.assignmentItem.findMany({
    where: { assignmentId, type: AssignmentItemType.EXTERNAL_CHALLENGE },
    orderBy: { position: "asc" },
    select: {
      id: true,
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
          flagDigest: true,
          flagFormat: true,
          maxAttempts: true,
          requireWriteup: true,
          requireWriteupUrl: true,
        },
      },
      challengeSubmissions: {
        where: { userId },
        take: 1,
        select: {
          attemptsCount: true,
          completedAt: true,
          score: true,
          writeup: true,
          writeupUrl: true,
        },
      },
    },
  });
  const challenges = items.filter(
    (item) => item.externalChallenge !== null && item.challengeGrading !== null,
  );

  if (!challenges.length) {
    if (!canManage) return null;
    return (
      <Card className="mt-5 border-dashed text-center">
        <Trophy className="mx-auto text-slate-400" />
        <h2 className="mt-3 text-lg font-bold">아직 등록된 외부 문제가 없습니다.</h2>
        <p className="mt-1 text-sm text-slate-500">DreamHack 또는 외부 워게임 문제를 과제에 추가해 보세요.</p>
        <Link
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 font-semibold text-white"
          href={`/organizations/${organizationId}/assignments/${assignmentId}/challenges/new`}
        >
          외부 문제 추가
        </Link>
      </Card>
    );
  }

  const completedCount = challenges.filter(
    (item) => item.challengeSubmissions[0]?.completedAt,
  ).length;
  const earnedPoints = challenges.reduce(
    (total, item) => total + (item.challengeSubmissions[0]?.score ?? 0),
    0,
  );
  const totalPoints = challenges.reduce(
    (total, item) => total + (item.externalChallenge?.points ?? 0),
    0,
  );

  return (
    <section className="mt-5" aria-labelledby="external-challenges-heading">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold" id="external-challenges-heading">
              <Flag size={20} /> 외부 문제
            </h2>
            <p className="mt-1 text-sm text-slate-500">각 문제를 풀고 플래그와 풀이 결과를 제출하세요.</p>
          </div>
          <div className="text-right text-sm">
            <strong className="block text-indigo-600">완료 {completedCount} / {challenges.length}</strong>
            <span className="text-slate-500">총점 {earnedPoints} / {totalPoints}</span>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-indigo-600"
            style={{ width: `${Math.round((completedCount / challenges.length) * 100)}%` }}
          />
        </div>
        {(canReview || canManage) && (
          <Link
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
            href={`/organizations/${organizationId}/assignments/${assignmentId}/challenges`}
          >
            <ListChecks size={16} /> 문제별 제출 현황
          </Link>
        )}
      </Card>

      <div className="mt-4 space-y-4">
        {challenges.map((item, index) => {
          const challenge = item.externalChallenge!;
          const grading = item.challengeGrading!;
          const submission = item.challengeSubmissions[0];
          const hasFlag = Boolean(grading.flagDigest);
          const problemUrl = normalizeSafeHttpsUrl(challenge.problemUrl);
          const access = getChallengeAttemptAccess({
            canSubmit,
            opensAt,
            deadline,
            allowLate,
            completedAt: submission?.completedAt,
            attemptsCount: submission?.attemptsCount ?? 0,
            maxAttempts: grading.maxAttempts,
          });
          const itemError = feedback.itemId === item.id && feedback.error
            ? ERROR_MESSAGES[feedback.error]
            : null;
          const itemSuccess = feedback.itemId === item.id && feedback.success
            ? SUCCESS_MESSAGES[feedback.success]
            : null;

          return (
            <Card key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500">
                    문제 {index + 1} · {EXTERNAL_CHALLENGE_SOURCE_LABELS[challenge.source]} · {challenge.platform}
                  </p>
                  <h3 className="mt-1 text-xl font-bold">{challenge.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {CHALLENGE_CATEGORY_LABELS[challenge.category]} · {challenge.difficulty}
                  </p>
                </div>
                <div className="text-right">
                  <strong className="block text-indigo-600">{challenge.points}점</strong>
                  {submission && (
                    <span className={submission.completedAt ? "text-xs font-semibold text-emerald-600" : "text-xs text-slate-500"}>
                      {submission.completedAt ? `완료 · ${submission.score}점` : `${submission.attemptsCount}회 시도`}
                    </span>
                  )}
                </div>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                {challenge.description}
              </p>
              {problemUrl && (
                <a
                  className="mt-3 inline-flex items-center gap-1 break-all text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                  href={problemUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  문제 열기 <ExternalLink size={15} />
                </a>
              )}

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                {hasFlag && <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">플래그 제출</span>}
                {grading.requireWriteup && <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">풀이 필수</span>}
                {grading.requireWriteupUrl && <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">라이트업 링크 필수</span>}
                <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                  최대 시도 {grading.maxAttempts ?? "무제한"}
                </span>
              </div>

              {itemError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-200" role="alert">{itemError}</p>}
              {itemSuccess && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200" role="status">{itemSuccess}</p>}

              {access === "ALLOWED" ? (
                <form action={submitExternalChallenge} className="mt-5 space-y-4">
                  <input name="organizationId" type="hidden" value={organizationId} />
                  <input name="assignmentId" type="hidden" value={assignmentId} />
                  <input name="itemId" type="hidden" value={item.id} />
                  {hasFlag && (
                    <label className="block text-sm font-medium">
                      플래그 {grading.flagFormat && <span className="text-slate-400">({grading.flagFormat})</span>}
                      <Input autoComplete="off" className="mt-2" maxLength={4_096} name="flag" required type="password" />
                    </label>
                  )}
                  <label className="block text-sm font-medium">
                    풀이 내용 {grading.requireWriteup ? <span className="text-red-500">*</span> : <span className="text-slate-400">(선택)</span>}
                    <textarea
                      className="mt-2 min-h-32 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                      defaultValue={submission?.writeup ?? ""}
                      maxLength={MAX_CHALLENGE_WRITEUP_LENGTH}
                      name="writeup"
                      required={grading.requireWriteup}
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    라이트업 링크 {grading.requireWriteupUrl ? <span className="text-red-500">*</span> : <span className="text-slate-400">(선택)</span>}
                    <Input
                      className="mt-2"
                      defaultValue={submission?.writeupUrl ?? ""}
                      maxLength={2_048}
                      name="writeupUrl"
                      pattern="https://.*"
                      required={grading.requireWriteupUrl}
                      type="url"
                    />
                  </label>
                  <Button type="submit">문제 결과 제출</Button>
                </form>
              ) : (
                <p className={access === "COMPLETED" ? "mt-4 text-sm font-semibold text-emerald-600" : "mt-4 text-sm font-semibold text-slate-500"}>
                  {ACCESS_MESSAGES[access]}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
