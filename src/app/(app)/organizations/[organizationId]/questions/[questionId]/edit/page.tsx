import { QuestionCategory } from "@prisma/client";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { canManageOrganization } from "@/features/organization/permissions";
import { deleteQuestion, updateQuestion } from "@/features/question/actions";
import { canEditQuestion } from "@/features/question/policy";
import { requireQuestionAccess } from "@/features/question/queries";
import { prisma } from "@/lib/prisma";

export default async function EditQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; questionId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { organizationId, questionId } = await params;
  const { error } = await searchParams;
  const { user, membership, question } = await requireQuestionAccess(organizationId, questionId);
  if (!canEditQuestion({ userId: user.id, systemRole: user.systemRole, membership, authorId: question.authorId })) notFound();
  const canManage = canManageOrganization({ systemRole: user.systemRole, membership });
  const assignments = await prisma.assignment.findMany({
    where: {
      organizationId,
      archivedAt: null,
      ...(canManage ? {} : { opensAt: { lte: new Date() }, OR: [{ audience: "ALL_MEMBERS" }, { targets: { some: { userId: user.id } } }] }),
    },
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-3xl">
      <BackLink href={`/organizations/${organizationId}/questions/${questionId}`} label="질문으로 돌아가기" />
      <h1 className="text-3xl font-bold">질문 수정</h1>
      <Card className="mt-6">
        {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error === "confirmation_mismatch" ? "삭제하려면 질문 제목을 정확히 입력해 주세요." : "입력 내용을 확인해 주세요."}</p>}
        <form action={updateQuestion} className="space-y-4">
          <input name="organizationId" type="hidden" value={organizationId} />
          <input name="questionId" type="hidden" value={questionId} />
          <label className="block">분야<select className="mt-2 min-h-11 w-full rounded-xl border px-3 dark:bg-slate-900" defaultValue={question.category} name="category">{Object.values(QuestionCategory).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="block">제목<Input className="mt-2" defaultValue={question.title} maxLength={120} minLength={2} name="title" required /></label>
          <label className="block">질문 내용<textarea className="mt-2 w-full rounded-xl border p-3 dark:bg-slate-900" defaultValue={question.content} maxLength={20000} minLength={10} name="content" required rows={8} /></label>
          <label className="block">시도한 내용<textarea className="mt-2 w-full rounded-xl border p-3 dark:bg-slate-900" defaultValue={question.attempted ?? ""} maxLength={10000} name="attempted" rows={4} /></label>
          <label className="block">오류 메시지<textarea className="mt-2 w-full rounded-xl border p-3 font-mono dark:bg-slate-900" defaultValue={question.errorMessage ?? ""} maxLength={10000} name="errorMessage" rows={3} /></label>
          <label className="block">코드<textarea className="mt-2 w-full rounded-xl border p-3 font-mono dark:bg-slate-900" defaultValue={question.code ?? ""} maxLength={20000} name="code" rows={6} /></label>
          <label className="block">관련 과제<select className="mt-2 min-h-11 w-full rounded-xl border px-3 dark:bg-slate-900" defaultValue={question.relatedAssignmentId ?? ""} name="relatedAssignmentId"><option value="">없음</option>{assignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.title}</option>)}</select></label>
          <p className="text-xs text-slate-500">게시판 공개 범위와 기존 첨부파일은 수정되지 않습니다.</p>
          <Button type="submit">수정 저장</Button>
        </form>
        <form action={deleteQuestion} className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700">
          <input name="organizationId" type="hidden" value={organizationId} />
          <input name="questionId" type="hidden" value={questionId} />
          <label className="block text-sm font-medium">질문을 삭제하려면 제목 <strong>{question.title}</strong>을 입력하세요.<Input autoComplete="off" className="mt-2" maxLength={120} name="confirmationTitle" required /></label>
          <Button className="mt-3 bg-red-600 hover:bg-red-700" type="submit">질문 삭제</Button>
        </form>
      </Card>
    </div>
  );
}
