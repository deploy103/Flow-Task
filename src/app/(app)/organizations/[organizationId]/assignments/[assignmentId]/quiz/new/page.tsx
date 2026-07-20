import { QuizResultRelease } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MAX_QUIZ_DESCRIPTION_LENGTH, MAX_QUIZ_TITLE_LENGTH, QUIZ_RESULT_RELEASE_LABELS } from "@/constants/quiz";
import { createQuiz } from "@/features/quiz/admin-actions";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization } from "@/features/organization/permissions";
import { prisma } from "@/lib/prisma";

export default async function NewQuizPage({ params, searchParams }: { params: Promise<{ organizationId: string; assignmentId: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ organizationId, assignmentId }, query] = await Promise.all([params, searchParams]);
  const { user, membership } = await requireOrganizationAccess(organizationId, true);
  if (!canManageOrganization({ systemRole: user.systemRole, membership })) notFound();
  const assignment = await prisma.assignment.findFirst({ where: { id: assignmentId, organizationId, archivedAt: null }, select: { title: true } });
  if (!assignment) notFound();
  return <div className="max-w-3xl"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500" href={`/organizations/${organizationId}/assignments/${assignmentId}`}><ArrowLeft size={17} /> 과제로 돌아가기</Link><h1 className="mt-4 text-3xl font-bold">온라인 퀴즈 추가</h1><p className="mt-2 text-slate-500">{assignment.title}에 퀴즈를 구성합니다.</p>{query.error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">퀴즈를 만들지 못했습니다. 입력을 확인해 주세요.</p>}<Card className="mt-6"><form action={createQuiz} className="space-y-5"><input name="organizationId" type="hidden" value={organizationId} /><input name="assignmentId" type="hidden" value={assignmentId} /><label className="block text-sm font-medium">퀴즈 제목<Input className="mt-2" maxLength={MAX_QUIZ_TITLE_LENGTH} name="title" required /></label><label className="block text-sm font-medium">설명<textarea className="mt-2 min-h-36 w-full rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" maxLength={MAX_QUIZ_DESCRIPTION_LENGTH} name="description" required /></label><div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium">제한 시간(분)<Input className="mt-2" max={1440} min={1} name="timeLimitMinutes" type="number" /></label><label className="text-sm font-medium">응시 횟수<Input className="mt-2" defaultValue={1} max={100} min={1} name="attemptLimit" required type="number" /></label><label className="text-sm font-medium">합격 점수<Input className="mt-2" min={0} name="passingScore" type="number" /></label></div><div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm"><input name="shuffleQuestions" type="checkbox" /> 문항 순서 섞기</label><label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm"><input name="shuffleChoices" type="checkbox" /> 선택지 순서 섞기</label></div><label className="block text-sm font-medium">결과 공개<select className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900" defaultValue={QuizResultRelease.AFTER_GRADING} name="resultRelease">{Object.values(QuizResultRelease).map((release) => <option key={release} value={release}>{QUIZ_RESULT_RELEASE_LABELS[release]}</option>)}</select></label><Button type="submit">퀴즈 만들고 문항 구성</Button></form></Card></div>;
}
