import {
  ChallengeCategory,
  ChallengeConnectionProtocol,
  InternalChallengeMode,
} from "@prisma/client";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CHALLENGE_CATEGORY_LABELS,
  CHALLENGE_CONNECTION_PROTOCOL_LABELS,
  INTERNAL_CHALLENGE_MODE_LABELS,
  MAX_CHALLENGE_DESCRIPTION_LENGTH,
  MAX_CHALLENGE_FLAG_FORMAT_LENGTH,
  MAX_CHALLENGE_FLAG_LENGTH,
  MAX_CHALLENGE_HINT_COUNT,
  MAX_CHALLENGE_HINT_LENGTH,
  MAX_CHALLENGE_RESOURCE_BYTES,
  MAX_CHALLENGE_TITLE_LENGTH,
} from "@/constants/challenge";
import { createInternalChallenge } from "@/features/challenge/internal-actions";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization } from "@/features/organization/permissions";
import { prisma } from "@/lib/prisma";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "입력값과 실행 방식별 접속 정보를 확인해 주세요.",
  invalid_resource: "문제 파일은 허용된 형식의 512KB 이하 파일이어야 합니다.",
  resource_required: "정적 파일형 문제에는 문제 파일이 필요합니다.",
  upload_failed: "문제 파일 업로드에 실패했습니다.",
  forbidden: "문제를 등록할 권한이 없습니다.",
  create_failed: "문제를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

export default async function NewInternalChallengePage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; assignmentId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ organizationId, assignmentId }, query] = await Promise.all([params, searchParams]);
  const { user, membership } = await requireOrganizationAccess(organizationId, true);
  if (!canManageOrganization({ systemRole: user.systemRole, membership })) notFound();
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, organizationId, archivedAt: null },
    select: { title: true },
  });
  if (!assignment) notFound();

  return (
    <div className="max-w-3xl">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500" href={`/organizations/${organizationId}/assignments/${assignmentId}`}>
        <ArrowLeft size={17} /> 과제로 돌아가기
      </Link>
      <h1 className="mt-4 text-3xl font-bold">자체 CTF 문제 추가</h1>
      <p className="mt-2 text-slate-500">{assignment.title}에 정적 파일형 또는 공용 서버형 문제를 추가합니다.</p>
      {query.error && ERROR_MESSAGES[query.error] && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{ERROR_MESSAGES[query.error]}</p>}

      <Card className="mt-6">
        <form action={createInternalChallenge} className="space-y-5">
          <input name="organizationId" type="hidden" value={organizationId} />
          <input name="assignmentId" type="hidden" value={assignmentId} />
          <label className="block text-sm font-medium">문제명<Input className="mt-2" maxLength={MAX_CHALLENGE_TITLE_LENGTH} name="title" required /></label>
          <label className="block text-sm font-medium">문제 설명<textarea className="mt-2 min-h-44 w-full rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" maxLength={MAX_CHALLENGE_DESCRIPTION_LENGTH} name="description" required /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">분야<select className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900" name="category">{Object.values(ChallengeCategory).map((category) => <option key={category} value={category}>{CHALLENGE_CATEGORY_LABELS[category]}</option>)}</select></label>
            <label className="text-sm font-medium">난이도<Input className="mt-2" maxLength={40} name="difficulty" required /></label>
            <label className="text-sm font-medium">배점<Input className="mt-2" min={0} name="points" required type="number" /></label>
            <label className="text-sm font-medium">실행 방식<select className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900" name="mode">{Object.values(InternalChallengeMode).map((mode) => <option key={mode} value={mode}>{INTERNAL_CHALLENGE_MODE_LABELS[mode]}</option>)}</select></label>
          </div>
          <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <legend className="px-2 text-sm font-bold">공용 서버 접속 정보</legend>
            <p className="mb-3 text-xs text-slate-500">공용 서버형일 때 세 값을 모두 입력하세요. 정적 파일형은 비워 둡니다.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">프로토콜<select className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900" defaultValue="" name="protocol"><option value="">선택</option>{Object.values(ChallengeConnectionProtocol).map((protocol) => <option key={protocol} value={protocol}>{CHALLENGE_CONNECTION_PROTOCOL_LABELS[protocol]}</option>)}</select></label>
              <label className="text-sm">호스트<Input className="mt-2" name="host" placeholder="challenge.example.com" /></label>
              <label className="text-sm">포트<Input className="mt-2" min={1} max={65535} name="port" type="number" /></label>
            </div>
          </fieldset>
          <label className="block text-sm font-medium">문제 파일 <span className="text-slate-400">(정적 파일형 필수)</span><Input accept=".pdf,.hwp,.hwpx,.docx,.pptx,.xlsx,.zip,.png,.jpg,.jpeg" className="mt-2" name="resource" type="file" /><span className="mt-1 block text-xs text-slate-500">비공개 저장 · 최대 {MAX_CHALLENGE_RESOURCE_BYTES / 1024}KB · 실행 파일은 ZIP으로 묶어 등록하세요.</span></label>
          <label className="block text-sm font-medium">힌트 <span className="text-slate-400">(한 줄에 하나)</span><textarea className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" maxLength={(MAX_CHALLENGE_HINT_LENGTH + 2) * MAX_CHALLENGE_HINT_COUNT} name="hints" /></label>
          <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <legend className="px-2 text-sm font-bold">플래그 자동 채점</legend>
            <label className="block text-sm font-medium">정답 플래그<Input autoComplete="off" className="mt-2" maxLength={MAX_CHALLENGE_FLAG_LENGTH} name="flag" required type="password" /></label>
            <label className="block text-sm font-medium">플래그 형식 안내<Input className="mt-2" maxLength={MAX_CHALLENGE_FLAG_FORMAT_LENGTH} name="flagFormat" placeholder="CTF{...}" /></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm"><input defaultChecked name="caseSensitive" type="checkbox" /> 대소문자 구분</label><label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm"><input defaultChecked name="trimWhitespace" type="checkbox" /> 앞뒤 공백 제거</label></div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">최대 시도 횟수<Input className="mt-2" min={1} name="maxAttempts" type="number" /></label><label className="text-sm font-medium">오답 1회당 감점<Input className="mt-2" defaultValue={0} min={0} name="penaltyPerWrongAttempt" required type="number" /></label></div>
            <div className="flex gap-3 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800"><ShieldCheck className="shrink-0" size={18} /><p>정답 원문은 저장하지 않고 서버 전용 pepper로 만든 HMAC digest만 저장합니다.</p></div>
          </fieldset>
          <Button type="submit">자체 CTF 문제 추가</Button>
        </form>
      </Card>
    </div>
  );
}
