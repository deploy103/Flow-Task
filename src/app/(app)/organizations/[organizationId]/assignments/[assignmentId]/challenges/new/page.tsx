import { ChallengeCategory, ExternalChallengeSource } from "@prisma/client";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CHALLENGE_CATEGORY_LABELS,
  EXTERNAL_CHALLENGE_SOURCE_LABELS,
} from "@/constants/challenge";
import { createExternalChallenge } from "@/features/challenge/actions";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { prisma } from "@/lib/prisma";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "문제 정보와 제출 조건을 다시 확인해 주세요.",
  invalid_url: "문제 링크는 안전한 HTTPS 주소여야 합니다.",
  submission_method_required: "플래그, 풀이, 라이트업 링크 중 하나 이상을 제출하도록 설정해 주세요.",
  create_failed: "외부 문제를 추가하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

export default async function NewExternalChallengePage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; assignmentId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ organizationId, assignmentId }, query] = await Promise.all([params, searchParams]);
  await requireOrganizationAccess(organizationId, true);
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, organizationId, archivedAt: null },
    select: { id: true, title: true },
  });
  if (!assignment) notFound();

  const errorMessage = query.error
    ? ERROR_MESSAGES[query.error] ?? "외부 문제를 추가하지 못했습니다. 입력 내용을 확인해 주세요."
    : null;

  return (
    <div className="max-w-3xl">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"
        href={`/organizations/${organizationId}/assignments/${assignmentId}/challenges`}
      >
        <ArrowLeft size={17} /> 외부 문제 관리로 돌아가기
      </Link>
      <p className="mt-5 text-sm font-semibold text-indigo-600">관리자 전용</p>
      <h1 className="mt-1 text-3xl font-bold">외부 문제 추가</h1>
      <p className="mt-2 text-slate-500">{assignment.title}에 워게임 문제와 채점 조건을 추가합니다.</p>

      <Card className="mt-6">
        {errorMessage && (
          <p
            className="mb-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-200"
            role="alert"
          >
            {errorMessage}
          </p>
        )}

        <form action={createExternalChallenge} className="space-y-6">
          <input name="organizationId" type="hidden" value={organizationId} />
          <input name="assignmentId" type="hidden" value={assignmentId} />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              문제 출처
              <select
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
                defaultValue={ExternalChallengeSource.DREAMHACK}
                name="source"
              >
                {Object.values(ExternalChallengeSource).map((source) => (
                  <option key={source} value={source}>{EXTERNAL_CHALLENGE_SOURCE_LABELS[source]}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              플랫폼
              <Input className="mt-2" defaultValue="DreamHack" maxLength={80} name="platform" required />
            </label>
          </div>

          <label className="block text-sm font-medium">
            문제명
            <Input className="mt-2" maxLength={160} name="title" required />
          </label>

          <label className="block text-sm font-medium">
            문제 설명
            <textarea
              className="mt-2 min-h-36 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              maxLength={20_000}
              name="description"
              placeholder="풀이에 필요한 안내나 주의 사항을 입력하세요."
              required
            />
          </label>

          <label className="block text-sm font-medium">
            문제 링크
            <Input
              className="mt-2"
              maxLength={2_048}
              name="problemUrl"
              pattern="https://.*"
              placeholder="https://dreamhack.io/wargame/challenges/..."
              required
              title="https://로 시작하는 주소를 입력하세요."
              type="url"
            />
            <span className="mt-1 block text-xs text-slate-500">문제 링크는 암호화된 HTTPS 주소만 사용할 수 있습니다.</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-medium">
              분야
              <select
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
                name="category"
              >
                {Object.values(ChallengeCategory).map((category) => (
                  <option key={category} value={category}>{CHALLENGE_CATEGORY_LABELS[category]}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              난이도
              <Input className="mt-2" maxLength={40} name="difficulty" placeholder="예: Level 2" required />
            </label>
            <label className="text-sm font-medium">
              배점
              <Input className="mt-2" defaultValue={100} max={100_000} min={0} name="points" required type="number" />
            </label>
          </div>

          <fieldset className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <legend className="px-2 text-sm font-bold">플래그 자동 채점</legend>
            <p className="text-xs leading-5 text-slate-500">
              정답 원문은 저장되지 않고 서버에서 안전하게 변환해 채점합니다. 플래그 제출을 받지 않으면 비워 두세요.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                정답 플래그
                <Input
                  autoComplete="off"
                  className="mt-2"
                  maxLength={4_096}
                  name="flag"
                  placeholder="DH{...}"
                  type="password"
                />
              </label>
              <label className="text-sm font-medium">
                플래그 형식 안내
                <Input className="mt-2" maxLength={160} name="flagFormat" placeholder="예: DH{...}" />
              </label>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-medium dark:bg-slate-800">
                <input defaultChecked name="caseSensitive" type="checkbox" /> 대소문자 구분
              </label>
              <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-medium dark:bg-slate-800">
                <input defaultChecked name="trimWhitespace" type="checkbox" /> 앞뒤 공백 제거
              </label>
            </div>
          </fieldset>

          <fieldset className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <legend className="px-2 text-sm font-bold">시도 및 제출 조건</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                최대 시도 횟수 <span className="text-slate-400">(비우면 무제한)</span>
                <Input className="mt-2" max={10_000} min={1} name="maxAttempts" type="number" />
              </label>
              <label className="text-sm font-medium">
                오답 1회당 감점
                <Input className="mt-2" defaultValue={0} max={100_000} min={0} name="penaltyPerWrongAttempt" type="number" />
              </label>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-medium dark:bg-slate-800">
                <input name="requireWriteup" type="checkbox" /> 풀이 내용 필수
              </label>
              <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-medium dark:bg-slate-800">
                <input name="requireWriteupUrl" type="checkbox" /> 라이트업 링크 필수
              </label>
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200">
              <ShieldCheck className="mt-0.5 shrink-0" size={18} />
              <p>정답 플래그, 필수 풀이 내용, 필수 라이트업 링크 중 하나 이상을 제출 조건으로 설정해야 합니다.</p>
            </div>
          </fieldset>

          <Button type="submit">외부 문제 추가</Button>
        </form>
      </Card>
    </div>
  );
}
