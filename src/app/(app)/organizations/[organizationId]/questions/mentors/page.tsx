import { MembershipRole, MembershipStatus, MentorRelationType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { assignMentorRelation } from "@/features/question/actions";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { prisma } from "@/lib/prisma";

export default async function MentorRelationsPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  await requireOrganizationAccess(organizationId, true);
  const [members, relations] = await Promise.all([
    prisma.organizationMember.findMany({ where: { organizationId, status: MembershipStatus.ACTIVE }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { user: { name: "asc" } } }),
    prisma.mentorRelation.findMany({ where: { organizationId, endedAt: null }, include: { mentor: { select: { name: true } }, mentee: { select: { name: true } } }, orderBy: { startedAt: "desc" } }),
  ]);
  const mentors = members.filter(({ role }) => role === MembershipRole.MENTOR);
  const mentees = members.filter(({ role }) => role === MembershipRole.MEMBER);
  return <div className="max-w-3xl"><p className="text-sm font-semibold text-indigo-600">관리자 전용</p><h1 className="mt-1 text-3xl font-bold">멘토·멘티 배정</h1><Card className="mt-6"><form action={assignMentorRelation} className="grid gap-4 sm:grid-cols-3"><input type="hidden" name="organizationId" value={organizationId}/><label className="text-sm font-medium">멘토<select name="mentorId" required className="mt-2 min-h-11 w-full rounded-xl border px-3 dark:bg-slate-900">{mentors.map(({user})=><option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label className="text-sm font-medium">멘티<select name="menteeId" required className="mt-2 min-h-11 w-full rounded-xl border px-3 dark:bg-slate-900">{mentees.map(({user})=><option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label className="text-sm font-medium">관계<select name="type" className="mt-2 min-h-11 w-full rounded-xl border px-3 dark:bg-slate-900">{Object.values(MentorRelationType).map((type)=><option key={type}>{type}</option>)}</select></label><Button type="submit" className="sm:col-span-3">배정 저장</Button></form></Card><div className="mt-6 space-y-3">{relations.map((relation)=><Card key={relation.id}><strong>{relation.mentor.name}</strong><span className="mx-2 text-slate-400">→</span>{relation.mentee.name}<span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">{relation.type}</span></Card>)}</div></div>;
}
