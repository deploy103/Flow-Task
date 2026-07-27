import { MembershipRole, QuestionBoardType } from "@prisma/client";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization } from "@/features/organization/permissions";
import { formatKoreanDateTime } from "@/lib/date";
import { prisma } from "@/lib/prisma";

const board = { PUBLIC_QNA: "전체 질문", MENTOR_QNA: "멘토 질문", PRIVATE_MENTOR: "1:1 질문" };
export default async function QuestionsPage({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: Promise<{ message?: string }> }) {
  const { organizationId } = await params; const { message } = await searchParams; const { user, membership } = await requireOrganizationAccess(organizationId); const admin = canManageOrganization({ systemRole: user.systemRole, membership }); const mentor = membership?.role === MembershipRole.MENTOR;
  const questions = await prisma.question.findMany({ where: { organizationId, hiddenAt: null, ...(admin ? {} : { OR: [{ boardType: QuestionBoardType.PUBLIC_QNA }, { authorId: user.id }, ...(mentor ? [{ boardType: QuestionBoardType.MENTOR_QNA }, { assignedMentorId: user.id }] : [])] }) }, include: { author: { select: { name: true } }, _count: { select: { answers: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return <div><div className="flex items-end justify-between"><div><p className="text-sm font-semibold text-indigo-600">질문과 답변</p><h1 className="mt-1 text-3xl font-bold">질문 게시판</h1></div><div className="flex gap-2">{admin && <Link className="rounded-xl border px-4 py-3 font-semibold" href={`/organizations/${organizationId}/questions/mentors`}>멘토 배정</Link>}<Link className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 font-semibold text-white" href={`/organizations/${organizationId}/questions/new`}><Plus size={18}/> 질문</Link></div></div>{message === "deleted" && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-200">질문을 삭제했습니다.</p>}<div className="mt-6 space-y-3">{questions.map((q) => <Link key={q.id} href={`/organizations/${organizationId}/questions/${q.id}`}><Card className="mb-3"><div className="flex gap-2 text-xs font-semibold text-indigo-600"><span>{board[q.boardType]}</span><span>{q.status}</span></div><h2 className="mt-2 font-bold">{q.title}</h2><p className="mt-2 text-xs text-slate-500">{q.author.name} · {formatKoreanDateTime(q.createdAt)} · 답변 {q._count.answers}</p></Card></Link>)}</div></div>;
}
