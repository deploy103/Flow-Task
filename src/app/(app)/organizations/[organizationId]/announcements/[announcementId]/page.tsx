import { AnnouncementAudience, MembershipStatus } from "@prisma/client";
import { CheckCircle2, Clock3, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { confirmAnnouncement } from "@/features/announcement/actions";
import { canViewAnnouncement } from "@/features/announcement/visibility";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization } from "@/features/organization/permissions";
import { formatKoreanDateTime } from "@/lib/date";
import { prisma } from "@/lib/prisma";

export default async function AnnouncementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; announcementId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { organizationId, announcementId } = await params;
  const notice = await searchParams;
  const { user, membership } = await requireOrganizationAccess(organizationId);
  const canManage = canManageOrganization({ systemRole: user.systemRole, membership });
  const announcement = await prisma.announcement.findFirst({
    where: { id: announcementId, organizationId, archivedAt: null },
    include: {
      author: { select: { name: true } },
      targets: { include: { user: { select: { id: true, name: true, email: true } } } },
      reads: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (!announcement) notFound();
  const now = new Date();
  const withinPublicationWindow =
    announcement.publishedAt <= now &&
    (announcement.expiresAt === null || announcement.expiresAt > now);
  const visible = canViewAnnouncement({
    audience: announcement.audience,
    recipientIds: announcement.targets.map(({ userId }) => userId),
    userId: user.id,
    systemRole: user.systemRole,
    canManage,
  });
  if ((!canManage && !withinPublicationWindow) || !visible) notFound();

  const confirmedByCurrentUser = announcement.reads.some(({ userId }) => userId === user.id);
  const recipients =
    announcement.audience === AnnouncementAudience.ALL_MEMBERS
      ? (
          await prisma.organizationMember.findMany({
            where: { organizationId, status: MembershipStatus.ACTIVE },
            select: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { user: { name: "asc" } },
          })
        ).map(({ user: recipient }) => recipient)
      : announcement.targets.map(({ user: recipient }) => recipient);
  const readsByUserId = new Map(announcement.reads.map((read) => [read.userId, read]));
  const confirmedRecipientCount = recipients.filter(({ id }) => readsByUserId.has(id)).length;

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center gap-2">{announcement.priority === "IMPORTANT" && <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 dark:bg-red-950">중요</span>}<span className="text-sm text-slate-500">{announcement.audience === AnnouncementAudience.ALL_MEMBERS ? "전체 구성원" : "선택 공개"}</span></div>
      <h1 className="mt-3 text-3xl font-bold">{announcement.title}</h1><p className="mt-2 text-sm text-slate-500">{announcement.author.name} · {formatKoreanDateTime(announcement.publishedAt)}</p>
      {notice.message === "confirmed" && <p className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-200">공지 확인을 기록했습니다.</p>}
      <Card className="mt-6"><div className="whitespace-pre-wrap leading-7">{announcement.content}</div></Card>
      <Card className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-bold">확인 상태</h2><p className="mt-1 text-sm text-slate-500">확인 버튼을 누르면 확인 시각이 기록됩니다.</p></div>{confirmedByCurrentUser ? <span className="inline-flex items-center gap-2 font-semibold text-green-600"><CheckCircle2 size={20} /> 확인 완료</span> : <form action={confirmAnnouncement}><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="announcementId" value={announcementId} /><Button type="submit">확인했습니다</Button></form>}</div>
      </Card>
      {canManage && <Card className="mt-5 overflow-hidden p-0"><div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800"><div><h2 className="flex items-center gap-2 font-bold"><Users size={19} /> 확인 현황</h2><p className="mt-1 text-sm text-slate-500">{confirmedRecipientCount} / {recipients.length}명 확인</p></div></div><ul className="divide-y divide-slate-200 dark:divide-slate-800">{recipients.map((recipient) => { const read = readsByUserId.get(recipient.id); return <li key={recipient.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-semibold">{recipient.name}</p><p className="text-sm text-slate-500">{recipient.email}</p></div>{read ? <span className="text-sm font-semibold text-green-600">{formatKoreanDateTime(read.confirmedAt)}</span> : <span className="inline-flex items-center gap-1 text-sm text-slate-400"><Clock3 size={16} /> 미확인</span>}</li>; })}</ul></Card>}
    </div>
  );
}
