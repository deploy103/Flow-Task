import { AnnouncementAudience, AnnouncementPriority, MembershipStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MAX_ANNOUNCEMENT_TITLE_LENGTH } from "@/constants/announcement";
import { archiveAnnouncement, updateAnnouncement } from "@/features/announcement/actions";
import { MarkdownEditor } from "@/features/announcement/components/markdown-editor";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { prisma } from "@/lib/prisma";

export default async function EditAnnouncementPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; announcementId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { organizationId, announcementId } = await params;
  const { error } = await searchParams;
  await requireOrganizationAccess(organizationId, true);
  const [announcement, members] = await Promise.all([
    prisma.announcement.findFirst({
      where: { id: announcementId, organizationId, archivedAt: null },
      include: { targets: { select: { userId: true } } },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId, status: MembershipStatus.ACTIVE },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);
  if (!announcement) notFound();
  const selectedIds = new Set(announcement.targets.map(({ userId }) => userId));

  return (
    <div className="max-w-3xl">
      <BackLink href={`/organizations/${organizationId}/announcements/${announcementId}`} label="공지로 돌아가기" />
      <p className="text-sm font-semibold text-indigo-600">관리자 전용</p>
      <h1 className="mt-1 text-3xl font-bold">공지 수정</h1>
      <Card className="mt-6">
        {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">입력 내용과 공지 대상을 확인해 주세요.</p>}
        <form action={updateAnnouncement} className="space-y-5">
          <input name="organizationId" type="hidden" value={organizationId} />
          <input name="announcementId" type="hidden" value={announcementId} />
          <label className="block text-sm font-medium">제목<Input className="mt-2" defaultValue={announcement.title} maxLength={MAX_ANNOUNCEMENT_TITLE_LENGTH} name="title" required /></label>
          <MarkdownEditor initialContent={announcement.content} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">중요도<select className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 dark:bg-slate-900" defaultValue={announcement.priority} name="priority"><option value={AnnouncementPriority.NORMAL}>일반</option><option value={AnnouncementPriority.IMPORTANT}>중요</option></select></label>
            <label className="text-sm font-medium">공개 대상<select className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 dark:bg-slate-900" defaultValue={announcement.audience} name="audience"><option value={AnnouncementAudience.ALL_MEMBERS}>전체 구성원</option><option value={AnnouncementAudience.SELECTED_MEMBERS}>선택한 구성원</option></select></label>
          </div>
          <fieldset><legend className="text-sm font-medium">개별 대상 선택 <span className="text-slate-400">(선택 공개일 때 적용)</span></legend><div className="mt-3 grid max-h-64 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">{members.map(({ user }) => <label className="flex items-start gap-2 rounded-lg p-2 text-sm" key={user.id}><input className="mt-1" defaultChecked={selectedIds.has(user.id)} name="recipientIds" type="checkbox" value={user.id} /><span><strong className="block">{user.name}</strong><span className="text-slate-500">{user.email}</span></span></label>)}</div></fieldset>
          <p className="text-xs text-amber-700 dark:text-amber-300">공지 내용을 수정하면 기존 확인 기록이 초기화됩니다.</p>
          <Button type="submit">수정 저장</Button>
        </form>
        <form action={archiveAnnouncement} className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700">
          <input name="organizationId" type="hidden" value={organizationId} />
          <input name="announcementId" type="hidden" value={announcementId} />
          <p className="mb-3 text-sm text-slate-500">공지 삭제 시 목록과 구성원 화면에서 즉시 숨겨지며 감사 기록은 보존됩니다.</p>
          <Button className="bg-red-600 hover:bg-red-700" type="submit">공지 삭제</Button>
        </form>
      </Card>
    </div>
  );
}
