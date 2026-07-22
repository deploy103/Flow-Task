import { AnnouncementAudience, AnnouncementPriority, MembershipStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BackLink } from "@/components/ui/back-link";
import { createAnnouncement } from "@/features/announcement/actions";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { prisma } from "@/lib/prisma";

export default async function NewAnnouncementPage({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { organizationId } = await params;
  const { error } = await searchParams;
  await requireOrganizationAccess(organizationId, true);
  const members = await prisma.organizationMember.findMany({
    where: { organizationId, status: MembershipStatus.ACTIVE },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return (
    <div className="max-w-3xl">
      <BackLink href={`/organizations/${organizationId}/announcements`} label="공지 목록" />
      <p className="text-sm font-semibold text-indigo-600">관리자 전용</p><h1 className="mt-1 text-3xl font-bold">공지 작성</h1>
      <Card className="mt-6">
        {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">입력 내용과 공지 대상을 확인해 주세요.</p>}
        <form action={createAnnouncement} className="space-y-5">
          <input type="hidden" name="organizationId" value={organizationId} />
          <label className="block text-sm font-medium">제목<Input name="title" required maxLength={100} className="mt-2" /></label>
          <label className="block text-sm font-medium">내용<textarea name="content" required maxLength={10000} rows={10} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">중요도<select name="priority" defaultValue={AnnouncementPriority.NORMAL} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"><option value={AnnouncementPriority.NORMAL}>일반</option><option value={AnnouncementPriority.IMPORTANT}>중요</option></select></label>
            <label className="text-sm font-medium">공개 대상<select name="audience" defaultValue={AnnouncementAudience.ALL_MEMBERS} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"><option value={AnnouncementAudience.ALL_MEMBERS}>전체 구성원</option><option value={AnnouncementAudience.SELECTED_MEMBERS}>선택한 구성원</option></select></label>
          </div>
          <fieldset><legend className="text-sm font-medium">개별 대상 선택 <span className="text-slate-400">(선택 공개일 때 적용)</span></legend><div className="mt-3 grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-2">{members.map(({ user }) => <label key={user.id} className="flex items-start gap-2 rounded-lg p-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><input type="checkbox" name="recipientIds" value={user.id} className="mt-1" /><span><strong className="block">{user.name}</strong><span className="text-slate-500">{user.email}</span></span></label>)}</div></fieldset>
          <Button type="submit">공지 등록</Button>
        </form>
      </Card>
    </div>
  );
}
