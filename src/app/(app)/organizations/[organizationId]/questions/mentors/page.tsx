import { MembershipStatus, MentoringRole, MentorRelationType } from "@prisma/client";
import { ArrowLeft, MessageCircle, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SECURITY_TRACK_LABELS } from "@/constants/member-classification";
import { canManageOrganization } from "@/features/organization/permissions";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { assignMentorRelation, endMentorRelation } from "@/features/question/actions";
import { prisma } from "@/lib/prisma";

const RELATION_LABELS: Record<MentorRelationType, string> = {
  [MentorRelationType.PRIMARY]: "주 멘토",
  [MentorRelationType.SECONDARY]: "보조 멘토",
};

export default async function MentorRelationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [{ organizationId }, notice] = await Promise.all([params, searchParams]);
  const { user, membership } = await requireOrganizationAccess(organizationId);
  const canManage = canManageOrganization({ systemRole: user.systemRole, membership });
  const relations = await prisma.mentorRelation.findMany({
    where: {
      organizationId,
      endedAt: null,
      ...(canManage ? {} : { OR: [{ mentorId: user.id }, { menteeId: user.id }] }),
    },
    include: { mentor: { select: { id: true, name: true } }, mentee: { select: { id: true, name: true } } },
    orderBy: [{ type: "asc" }, { startedAt: "desc" }],
  });
  const visibleUserIds = [...new Set([user.id, ...relations.flatMap((relation) => [relation.mentorId, relation.menteeId])])];
  const members = await prisma.organizationMember.findMany({
    where: {
      organizationId,
      status: MembershipStatus.ACTIVE,
      ...(canManage ? {} : { userId: { in: visibleUserIds } }),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: [{ securityTrack: "asc" }, { user: { name: "asc" } }],
  });
  const mentors = members.filter(({ mentoringRole, securityTrack }) => mentoringRole === MentoringRole.MENTOR && securityTrack);
  const mentees = members.filter(({ mentoringRole, securityTrack }) => mentoringRole === MentoringRole.MENTEE && securityTrack);
  const trackByUserId = new Map(members.map((member) => [member.userId, member.securityTrack]));
  const myOpenQuestionCount = await prisma.question.count({
    where: {
      organizationId,
      hiddenAt: null,
      status: { notIn: ["RESOLVED", "CLOSED"] },
      OR: [{ authorId: user.id }, { assignedMentorId: user.id }],
    },
  });

  return (
    <div className="max-w-4xl">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500" href={`/organizations/${organizationId}`}><ArrowLeft size={17} /> 조직 홈</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold text-indigo-600">분야별 성장 관리</p><h1 className="mt-1 text-3xl font-bold">멘토링</h1><p className="mt-2 text-slate-500">같은 보안 분야의 멘토와 멘티를 연결하고 1:1 질문을 이어갑니다.</p></div>
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 font-semibold text-white" href={`/organizations/${organizationId}/questions/new?board=PRIVATE_MENTOR`}><MessageCircle size={18} /> 1:1 질문</Link>
      </div>

      {notice.message && <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{notice.message === "ended" ? "멘토링 관계를 종료했습니다." : "멘토링 관계를 저장했습니다."}</p>}
      {notice.error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">멘토·멘티 역할과 보안 분야가 올바른지 확인해 주세요. 같은 분야끼리만 배정할 수 있습니다.</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card><p className="text-sm text-slate-500">나와 연결된 멘토링</p><strong className="mt-1 block text-3xl">{relations.length}</strong></Card>
        <Card><p className="text-sm text-slate-500">내 미해결 질문</p><strong className="mt-1 block text-3xl">{myOpenQuestionCount}</strong></Card>
      </div>

      {canManage && (
        <Card className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-bold"><UserRoundCheck size={20} /> 멘토·멘티 배정</h2>
          <p className="mt-1 text-sm text-slate-500">구성원 관리에서 멘토링 역할과 분야를 먼저 지정하세요.</p>
          <form action={assignMentorRelation} className="mt-5 grid gap-4 sm:grid-cols-3">
            <input type="hidden" name="organizationId" value={organizationId} />
            <label className="text-sm font-medium">멘토<select name="mentorId" required className="mt-2 min-h-11 w-full rounded-xl border px-3 dark:bg-slate-900"><option value="">선택</option>{mentors.map(({ user: mentor, securityTrack }) => <option key={mentor.id} value={mentor.id}>{mentor.name} · {securityTrack && SECURITY_TRACK_LABELS[securityTrack]}</option>)}</select></label>
            <label className="text-sm font-medium">멘티<select name="menteeId" required className="mt-2 min-h-11 w-full rounded-xl border px-3 dark:bg-slate-900"><option value="">선택</option>{mentees.map(({ user: mentee, securityTrack }) => <option key={mentee.id} value={mentee.id}>{mentee.name} · {securityTrack && SECURITY_TRACK_LABELS[securityTrack]}</option>)}</select></label>
            <label className="text-sm font-medium">관계<select name="type" className="mt-2 min-h-11 w-full rounded-xl border px-3 dark:bg-slate-900">{Object.values(MentorRelationType).map((type) => <option key={type} value={type}>{RELATION_LABELS[type]}</option>)}</select></label>
            <Button type="submit" className="sm:col-span-3">배정 저장</Button>
          </form>
        </Card>
      )}

      <div className="mt-6 space-y-3">
        <h2 className="text-lg font-bold">현재 멘토링 관계</h2>
        {relations.map((relation) => {
          const track = trackByUserId.get(relation.mentorId);
          return <Card key={relation.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><strong>{relation.mentor.name}</strong><span className="mx-2 text-slate-400">→</span>{relation.mentee.name}<div className="mt-2 flex gap-2"><span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">{RELATION_LABELS[relation.type]}</span>{track && <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold dark:bg-slate-800">{SECURITY_TRACK_LABELS[track]}</span>}</div></div>{canManage && <form action={endMentorRelation}><input name="organizationId" type="hidden" value={organizationId} /><input name="relationId" type="hidden" value={relation.id} /><Button className="min-h-9 bg-red-600 hover:bg-red-700" type="submit">관계 종료</Button></form>}</div></Card>;
        })}
        {!relations.length && <Card className="border-dashed text-center text-sm text-slate-500">현재 연결된 멘토링 관계가 없습니다.</Card>}
      </div>
    </div>
  );
}
