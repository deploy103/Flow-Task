import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/features/auth/guards";
import { markAllNotificationsRead, markNotificationRead } from "@/features/notification/actions";
import { syncAssignmentNotifications } from "@/features/notification/queries";
import { formatKoreanDateTime } from "@/lib/date";
import { prisma } from "@/lib/prisma";

export default async function NotificationsPage() {
  const user = await requireAuthenticatedUser();
  await syncAssignmentNotifications(user.id);
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = notifications.filter(({ readAt }) => !readAt).length;

  return <div className="max-w-3xl">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold text-indigo-600">읽지 않음 {unread}개</p><h1 className="mt-1 text-3xl font-bold">알림</h1></div>
      {unread > 0 && <form action={markAllNotificationsRead}><Button type="submit" className="gap-2"><CheckCheck size={18} /> 모두 읽음</Button></form>}
    </div>
    <div className="mt-6 space-y-3">
      {notifications.map((notification) => <Card key={notification.id} className={notification.readAt ? "opacity-70" : "border-indigo-200"}>
        <div className="flex items-start gap-3"><Bell className="mt-1 shrink-0 text-indigo-600" size={19} /><div className="min-w-0 flex-1"><Link href={notification.href} className="font-bold hover:text-indigo-600">{notification.title}</Link><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{notification.body}</p><p className="mt-2 text-xs text-slate-400">{formatKoreanDateTime(notification.createdAt)}</p></div>{!notification.readAt && <form action={markNotificationRead}><input type="hidden" name="notificationId" value={notification.id} /><Button type="submit" className="min-h-9 bg-slate-100 px-3 text-xs text-slate-700 hover:bg-slate-200">읽음</Button></form>}</div>
      </Card>)}
      {!notifications.length && <Card className="text-center text-sm text-slate-500">새 알림이 없습니다.</Card>}
    </div>
  </div>;
}
