import { AnnouncementAudience } from "@prisma/client";
import { Bell, Plus } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization } from "@/features/organization/permissions";
import { formatKoreanDateTime } from "@/lib/date";
import { prisma } from "@/lib/prisma";

export default async function AnnouncementsPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const { user, membership } = await requireOrganizationAccess(organizationId);
  const canManage = canManageOrganization({ systemRole: user.systemRole, membership });
  const announcements = await prisma.announcement.findMany({
    where: {
      organizationId,
      archivedAt: null,
      ...(canManage
        ? {}
        : {
            publishedAt: { lte: new Date() },
            AND: [
              { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
              {
                OR: [
                  { audience: AnnouncementAudience.ALL_MEMBERS },
                  { targets: { some: { userId: user.id } } },
                ],
              },
            ],
          }),
    },
    include: {
      author: { select: { name: true } },
      reads: { where: { userId: user.id }, select: { confirmedAt: true } },
    },
    orderBy: [{ priority: "desc" }, { publishedAt: "desc" }],
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold text-indigo-600">조직 소식</p><h1 className="mt-1 text-3xl font-bold">공지사항</h1><p className="mt-2 text-slate-500">중요한 소식과 확인할 내용을 모아봤어요.</p></div>
        {canManage && <Link href={`/organizations/${organizationId}/announcements/new`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 font-semibold text-white"><Plus size={18} /> 공지 작성</Link>}
      </div>
      {announcements.length ? (
        <div className="mt-6 space-y-3">
          {announcements.map((announcement) => (
            <Link key={announcement.id} href={`/organizations/${organizationId}/announcements/${announcement.id}`}>
              <Card className="mb-3 transition hover:border-indigo-300 hover:shadow-md">
                <div className="flex flex-wrap items-center gap-2">
                  {announcement.priority === "IMPORTANT" && <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 dark:bg-red-950">중요</span>}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${announcement.reads.length ? "bg-green-50 text-green-700 dark:bg-green-950" : "bg-amber-50 text-amber-700 dark:bg-amber-950"}`}>{announcement.reads.length ? "확인함" : "미확인"}</span>
                </div>
                <h2 className="mt-3 text-lg font-bold">{announcement.title}</h2>
                <p className="mt-2 text-sm text-slate-500">{announcement.author.name} · {formatKoreanDateTime(announcement.publishedAt)}</p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="mt-6 border-dashed text-center"><Bell className="mx-auto text-slate-400" /><p className="mt-3 font-semibold">아직 공지가 없어요</p></Card>
      )}
    </div>
  );
}
