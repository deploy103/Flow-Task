import { QuestionBoardType, QuestionCategory } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { createQuestion } from "@/features/question/actions";
import { prisma } from "@/lib/prisma";

const BOARD_LABELS: Record<QuestionBoardType, string> = {
  [QuestionBoardType.PUBLIC_QNA]: "전체 공개 질문",
  [QuestionBoardType.MENTOR_QNA]: "멘토 그룹 질문",
  [QuestionBoardType.PRIVATE_MENTOR]: "담당 멘토 1:1 질문",
};

const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  [QuestionCategory.WEB]: "Web",
  [QuestionCategory.SYSTEM]: "Pwnable / System",
  [QuestionCategory.REVERSING]: "Reversing",
  [QuestionCategory.FORENSICS]: "Forensics",
  [QuestionCategory.CRYPTOGRAPHY]: "Crypto",
  [QuestionCategory.NETWORK]: "Network",
  [QuestionCategory.PROGRAMMING]: "Programming",
  [QuestionCategory.ASSIGNMENT]: "과제",
  [QuestionCategory.OTHER]: "기타",
};

export default async function NewQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ board?: string; error?: string }>;
}) {
  const [{ organizationId }, query] = await Promise.all([params, searchParams]);
  const { user, membership } = await requireOrganizationAccess(organizationId);
  const assignments = await prisma.assignment.findMany({
    where: {
      organizationId,
      archivedAt: null,
      opensAt: { lte: new Date() },
      OR: [{ audience: "ALL_MEMBERS" }, { targets: { some: { userId: user.id } } }],
    },
    select: { id: true, title: true },
  });
  const primaryMentor = membership?.mentoringRole === "MENTEE" ? await prisma.mentorRelation.findFirst({
    where: { organizationId, menteeId: user.id, type: "PRIMARY", endedAt: null },
    include: { mentor: { select: { name: true } } },
  }) : null;
  const requestedBoard = Object.values(QuestionBoardType).includes(query.board as QuestionBoardType)
    ? query.board as QuestionBoardType
    : QuestionBoardType.PUBLIC_QNA;

  return <div className="max-w-3xl"><BackLink href={`/organizations/${organizationId}/questions`} label="질문 목록"/><h1 className="text-3xl font-bold">질문 작성</h1><p className="mt-2 text-sm text-slate-500">{primaryMentor ? `담당 멘토: ${primaryMentor.mentor.name}` : "담당 주 멘토가 없으면 1:1 질문을 작성할 수 없습니다."}</p>{query.error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">질문을 등록할 수 없습니다. 게시판 권한과 담당 멘토 배정 여부를 확인해 주세요.</p>}<Card className="mt-6"><form action={createQuestion} className="space-y-4" encType="multipart/form-data"><input type="hidden" name="organizationId" value={organizationId}/><label className="block">게시판<select name="boardType" defaultValue={requestedBoard} className="mt-2 min-h-11 w-full rounded-xl border px-3 dark:bg-slate-900">{Object.values(QuestionBoardType).map((value) => <option key={value} value={value}>{BOARD_LABELS[value]}</option>)}</select></label><label className="block">분야<select name="category" className="mt-2 min-h-11 w-full rounded-xl border px-3 dark:bg-slate-900">{Object.values(QuestionCategory).map((value) => <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>)}</select></label><label className="block">제목<Input name="title" required minLength={2} maxLength={120} className="mt-2"/></label><label className="block">질문 내용<textarea name="content" required minLength={10} maxLength={20000} rows={8} className="mt-2 w-full rounded-xl border p-3 dark:bg-slate-900"/></label><label className="block">시도한 내용<textarea name="attempted" maxLength={10000} rows={4} className="mt-2 w-full rounded-xl border p-3 dark:bg-slate-900"/></label><label className="block">오류 메시지<textarea name="errorMessage" maxLength={10000} rows={3} className="mt-2 w-full rounded-xl border p-3 font-mono dark:bg-slate-900"/></label><label className="block">코드<textarea name="code" maxLength={20000} rows={6} className="mt-2 w-full rounded-xl border p-3 font-mono dark:bg-slate-900"/></label><label className="block">관련 과제<select name="relatedAssignmentId" className="mt-2 min-h-11 w-full rounded-xl border px-3 dark:bg-slate-900"><option value="">없음</option>{assignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.title}</option>)}</select></label><label className="block">첨부파일 (최대 512KB)<Input type="file" name="attachment" accept=".pdf,.png,.jpg,.jpeg,.zip,.hwp,.hwpx,.docx,.xlsx,.pptx" className="mt-2"/></label><Button type="submit">질문 등록</Button></form></Card></div>;
}
