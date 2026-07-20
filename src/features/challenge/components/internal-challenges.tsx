import { AssignmentItemType, ChallengeConnectionProtocol, InternalChallengeMode } from "@prisma/client";
import { Download, Flag, Lightbulb, ListChecks, Plus, Server } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CHALLENGE_CATEGORY_LABELS,
  CHALLENGE_CONNECTION_PROTOCOL_LABELS,
  INTERNAL_CHALLENGE_MODE_LABELS,
} from "@/constants/challenge";
import { getChallengeAttemptAccess, type ChallengeAttemptAccessReason } from "../access";
import { submitChallenge } from "../actions";
import { startChallengeInstance, stopChallengeInstance } from "../instance-actions";
import { prisma } from "@/lib/prisma";

const ACCESS_MESSAGES: Record<Exclude<ChallengeAttemptAccessReason, "ALLOWED">, string> = {
  NOT_TARGET: "이 과제의 제출 대상이 아닙니다.",
  NOT_OPEN: "아직 문제 제출 기간이 시작되지 않았습니다.",
  CLOSED: "문제 제출 기간이 종료되었습니다.",
  COMPLETED: "완료한 문제입니다.",
  ATTEMPT_LIMIT: "최대 시도 횟수를 모두 사용했습니다.",
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "플래그를 다시 확인해 주세요.",
  incorrect_flag: "플래그가 일치하지 않습니다.",
  not_open: "아직 문제 제출 기간이 시작되지 않았습니다.",
  closed: "문제 제출 기간이 종료되었습니다.",
  not_target: "이 과제의 제출 대상이 아닙니다.",
  already_completed: "이미 완료한 문제입니다.",
  attempt_limit: "최대 시도 횟수를 모두 사용했습니다.",
  submit_failed: "제출을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  instance_forbidden: "현재 개인 인스턴스를 시작할 수 없습니다.",
  instance_start_failed: "격리 실행 제공자가 인스턴스를 시작하지 못했습니다.",
  instance_not_found: "종료할 활성 인스턴스가 없습니다.",
  instance_stop_failed: "인스턴스 종료 요청에 실패했습니다.",
};

function connectionHref(protocol: ChallengeConnectionProtocol | null, host: string | null, port: number | null) {
  if (!protocol || !host || !port) return null;
  if (protocol === ChallengeConnectionProtocol.HTTPS) return `https://${host}:${port}`;
  if (protocol === ChallengeConnectionProtocol.HTTP) return `http://${host}:${port}`;
  return null;
}

export async function InternalChallenges({
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
    where: { assignmentId, type: AssignmentItemType.INTERNAL_CTF },
    orderBy: { position: "asc" },
    select: {
      id: true,
      internalChallenge: {
        select: {
          title: true,
          description: true,
          category: true,
          difficulty: true,
          points: true,
          mode: true,
          protocol: true,
          host: true,
          port: true,
          instanceLifetimeMinutes: true,
          instances: { where: { userId }, orderBy: { startedAt: "desc" }, take: 1, select: { id: true, status: true, connectionHost: true, connectionPort: true, connectionProtocol: true, expiresAt: true } },
          hints: { orderBy: { position: "asc" }, select: { id: true, content: true } },
          resources: { orderBy: { createdAt: "asc" }, select: { id: true, originalFilename: true, sizeBytes: true } },
        },
      },
      challengeGrading: { select: { flagFormat: true, maxAttempts: true } },
      challengeSubmissions: {
        where: { userId },
        take: 1,
        select: { attemptsCount: true, completedAt: true, score: true },
      },
    },
  });
  const challenges = items.filter((item) => item.internalChallenge && item.challengeGrading);
  if (!challenges.length) {
    if (!canManage) return null;
    return <Card className="mt-5 border-dashed text-center"><Flag className="mx-auto text-slate-400" /><h2 className="mt-3 text-lg font-bold">아직 자체 CTF 문제가 없습니다.</h2><Link className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 font-semibold text-white" href={`/organizations/${organizationId}/assignments/${assignmentId}/ctf/new`}><Plus size={17} /> 문제 추가</Link></Card>;
  }

  const completed = challenges.filter((item) => item.challengeSubmissions[0]?.completedAt).length;
  return (
    <section className="mt-5" aria-labelledby="internal-challenges-heading">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 text-lg font-bold" id="internal-challenges-heading"><Flag size={20} /> 자체 CTF 문제</h2><p className="mt-1 text-sm text-slate-500">문제 파일 또는 공용 서버를 이용해 플래그를 찾으세요.</p></div><strong className="text-indigo-600">완료 {completed} / {challenges.length}</strong></div>
        {(canReview || canManage) && <Link className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600" href={`/organizations/${organizationId}/assignments/${assignmentId}/ctf`}><ListChecks size={16} /> 자체 문제 제출 현황</Link>}
      </Card>
      <div className="mt-4 space-y-4">
        {challenges.map((item, index) => {
          const challenge = item.internalChallenge!;
          const grading = item.challengeGrading!;
          const submission = item.challengeSubmissions[0];
          const access = getChallengeAttemptAccess({ canSubmit, opensAt, deadline, allowLate, completedAt: submission?.completedAt, attemptsCount: submission?.attemptsCount ?? 0, maxAttempts: grading.maxAttempts });
          const href = connectionHref(challenge.protocol, challenge.host, challenge.port);
          const instance = challenge.instances[0] && challenge.instances[0].expiresAt > new Date() ? challenge.instances[0] : null;
          const instanceHref = instance ? connectionHref(instance.connectionProtocol, instance.connectionHost, instance.connectionPort) : null;
          const error = feedback.itemId === item.id && feedback.error ? ERROR_MESSAGES[feedback.error] : null;
          return (
            <Card key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-slate-500">문제 {index + 1} · {INTERNAL_CHALLENGE_MODE_LABELS[challenge.mode]} · {CHALLENGE_CATEGORY_LABELS[challenge.category]}</p><h3 className="mt-1 text-xl font-bold">{challenge.title}</h3><p className="mt-1 text-xs text-slate-500">난이도 {challenge.difficulty}</p></div><strong className="text-indigo-600">{challenge.points}점</strong></div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{challenge.description}</p>
              {challenge.host && challenge.protocol && challenge.port && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800"><p className="flex items-center gap-2 font-semibold"><Server size={17} /> {CHALLENGE_CONNECTION_PROTOCOL_LABELS[challenge.protocol]} 접속</p>{href ? <a className="mt-1 block break-all text-indigo-600 hover:underline" href={href} rel="noopener noreferrer" target="_blank">{challenge.host}:{challenge.port}</a> : <code className="mt-1 block break-all">{challenge.host}:{challenge.port}</code>}</div>}
              {challenge.mode === InternalChallengeMode.PERSONAL_INSTANCE && <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800"><p className="flex items-center gap-2 font-semibold"><Server size={17} /> 개인 격리 인스턴스 · 최대 {challenge.instanceLifetimeMinutes}분</p>{instance?.status === "RUNNING" && instance.connectionHost && instance.connectionPort ? <><p className="mt-2 text-xs text-slate-500">만료 {instance.expiresAt.toLocaleString("ko-KR")}</p>{instanceHref ? <a className="mt-1 block text-indigo-600" href={instanceHref} rel="noopener noreferrer" target="_blank">{instance.connectionHost}:{instance.connectionPort}</a> : <code className="mt-1 block">{instance.connectionHost}:{instance.connectionPort}</code>}<form action={stopChallengeInstance} className="mt-3"><input name="organizationId" type="hidden" value={organizationId} /><input name="assignmentId" type="hidden" value={assignmentId} /><input name="itemId" type="hidden" value={item.id} /><input name="instanceId" type="hidden" value={instance.id} /><Button type="submit">인스턴스 종료</Button></form></> : instance?.status === "STARTING" ? <p className="mt-2 text-slate-500">인스턴스를 준비하고 있습니다.</p> : <form action={startChallengeInstance} className="mt-3"><input name="organizationId" type="hidden" value={organizationId} /><input name="assignmentId" type="hidden" value={assignmentId} /><input name="itemId" type="hidden" value={item.id} /><Button type="submit">개인 인스턴스 시작</Button></form>}</div>}
              {challenge.resources.map((resource) => <a className="mt-3 flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline" href={`/api/challenge-resources/${resource.id}`} key={resource.id}><Download size={16} /> {resource.originalFilename} ({Math.ceil(Number(resource.sizeBytes) / 1024)}KB)</a>)}
              {challenge.hints.length > 0 && <details className="mt-4 rounded-xl border border-amber-200 p-3"><summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><Lightbulb size={16} /> 힌트 {challenge.hints.length}개</summary><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">{challenge.hints.map((hint) => <li key={hint.id}>{hint.content}</li>)}</ol></details>}
              {submission && <p className="mt-4 text-sm text-slate-500">시도 {submission.attemptsCount}회 · {submission.completedAt ? `완료 ${submission.score}점` : "진행 중"}</p>}
              {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{error}</p>}
              {feedback.itemId === item.id && feedback.success === "completed" && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700" role="status">문제를 완료했습니다.</p>}
              {access === "ALLOWED" ? <form action={submitChallenge} className="mt-5 flex flex-wrap items-end gap-3"><input name="organizationId" type="hidden" value={organizationId} /><input name="assignmentId" type="hidden" value={assignmentId} /><input name="itemId" type="hidden" value={item.id} /><label className="min-w-64 flex-1 text-sm font-medium">플래그 {grading.flagFormat && <span className="text-slate-400">({grading.flagFormat})</span>}<Input autoComplete="off" className="mt-2" name="flag" required type="password" /></label><Button type="submit">플래그 제출</Button></form> : <p className={access === "COMPLETED" ? "mt-4 text-sm font-semibold text-emerald-600" : "mt-4 text-sm font-semibold text-slate-500"}>{ACCESS_MESSAGES[access]}</p>}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
