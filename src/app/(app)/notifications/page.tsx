import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/features/auth/guards";
import { markAllNotificationsRead, markNotificationRead } from "@/features/notification/actions";
import { updateNotificationPreference } from "@/features/notification/advanced-actions";
import { PushSubscribe } from "@/features/notification/components/push-subscribe";
import { syncAssignmentNotifications } from "@/features/notification/queries";
import { formatKoreanDateTime } from "@/lib/date";
import { prisma } from "@/lib/prisma";

export default async function NotificationsPage() {
  const user = await requireAuthenticatedUser();
  await syncAssignmentNotifications(user.id);
  const [notifications, preference] = await Promise.all([prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  }), prisma.notificationPreference.findUnique({ where: { userId: user.id } })]);
  const unread = notifications.filter(({ readAt }) => !readAt).length;

  return <div className="max-w-3xl">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold text-indigo-600">읽지 않음 {unread}개</p><h1 className="mt-1 text-3xl font-bold">알림</h1></div>
      {unread > 0 && <form action={markAllNotificationsRead}><Button type="submit" className="gap-2"><CheckCheck size={18} /> 모두 읽음</Button></form>}
    </div>
    <Card className="mt-6"><h2 className="font-bold">외부 알림 채널</h2><form action={updateNotificationPreference} className="mt-3 grid gap-3 sm:grid-cols-3"><label className="flex items-center gap-2 text-sm"><input defaultChecked={preference?.emailEnabled} name="emailEnabled" type="checkbox" /> 이메일</label><label className="flex items-center gap-2 text-sm"><input defaultChecked={preference?.webPushEnabled} name="webPushEnabled" type="checkbox" /> 웹 푸시</label><label className="flex items-center gap-2 text-sm"><input defaultChecked={preference?.discordEnabled} name="discordEnabled" type="checkbox" /> Discord</label><Button type="submit">채널 설정 저장</Button><PushSubscribe publicKey={process.env.WEB_PUSH_VAPID_PUBLIC_KEY} /></form></Card>
    <div className="mt-6 space-y-3">
      {notifications.map((notification) => <Card key={notification.id} className={notification.readAt ? "opacity-70" : "border-indigo-200"}>
        <div className="flex items-start gap-3"><Bell className="mt-1 shrink-0 text-indigo-600" size={19} /><div className="min-w-0 flex-1"><Link href={notification.href} className="font-bold hover:text-indigo-600">{notification.title}</Link><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{notification.body}</p><p className="mt-2 text-xs text-slate-400">{formatKoreanDateTime(notification.createdAt)}</p></div>{!notification.readAt && <form action={markNotificationRead}><input type="hidden" name="notificationId" value={notification.id} /><Button type="submit" className="min-h-9 bg-slate-100 px-3 text-xs text-slate-700 hover:bg-slate-200">읽음</Button></form>}</div>
      </Card>)}
      {!notifications.length && <Card className="text-center text-sm text-slate-500">새 알림이 없습니다.</Card>}
    </div>
  </div>;
}
