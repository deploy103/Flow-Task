import {
  ChallengeInstanceStatus,
  NotificationDeliveryStatus,
  SubmissionUploadStatus,
  SystemRole,
} from "@prisma/client";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Building2,
  CheckCircle2,
  Clock3,
  Database,
  HardDrive,
  Server,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { requireSystemAdministrator } from "@/features/auth/guards";
import { prisma } from "@/lib/prisma";

function startOfTodayInKorea(now = new Date()) {
  const koreaOffsetMilliseconds = 9 * 60 * 60 * 1_000;
  const koreaNow = new Date(now.getTime() + koreaOffsetMilliseconds);
  koreaNow.setUTCHours(0, 0, 0, 0);
  return new Date(koreaNow.getTime() - koreaOffsetMilliseconds);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function formatBytes(value: bigint | null | undefined) {
  const bytes = Number(value ?? 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

async function measureDatabaseLatency() {
  const startedAt = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  return Math.max(1, Math.round(performance.now() - startedAt));
}

function StatusPill({ healthy, children }: { healthy: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${healthy ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>
      {healthy ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
      {children}
    </span>
  );
}

export default async function SystemAdminDashboard() {
  await requireSystemAdministrator();
  const today = startOfTodayInKorea();
  const [
    users,
    newUsersToday,
    activeOrganizations,
    runningInstances,
    failedDeliveries,
    pendingDeliveries,
    cleanupFailures,
    pendingUploads,
    uploadStorage,
    databaseLatency,
    recentAuditLogs,
    recentDeliveryFailures,
    recentCleanupFailures,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.organization.count({ where: { archivedAt: null } }),
    prisma.challengeInstance.count({
      where: { status: { in: [ChallengeInstanceStatus.STARTING, ChallengeInstanceStatus.RUNNING] } },
    }),
    prisma.notificationDelivery.count({ where: { status: NotificationDeliveryStatus.FAILED } }),
    prisma.notificationDelivery.count({ where: { status: NotificationDeliveryStatus.PENDING } }),
    prisma.submissionUpload.count({ where: { cleanupError: { not: null } } }),
    prisma.submissionUpload.count({ where: { status: SubmissionUploadStatus.PENDING } }),
    prisma.submissionUpload.aggregate({ _sum: { sizeBytes: true, reservedBytes: true } }),
    measureDatabaseLatency(),
    prisma.auditLog.findMany({
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.notificationDelivery.findMany({
      where: { status: NotificationDeliveryStatus.FAILED },
      include: { notification: { select: { title: true } } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.submissionUpload.findMany({
      where: { cleanupError: { not: null } },
      select: { id: true, originalFilename: true, cleanupError: true, lastCleanupAttemptAt: true },
      orderBy: { lastCleanupAttemptAt: "desc" },
      take: 6,
    }),
  ]);

  const localStorageConfigured = Boolean(process.env.LOCAL_STORAGE_ROOT?.startsWith("/"));
  const adminCount = await prisma.user.count({ where: { systemRole: SystemRole.SYSTEM_ADMIN } });
  const recentErrors = [
    ...recentDeliveryFailures.map((item) => ({
      id: `delivery-${item.id}`,
      label: `알림 전송 실패 · ${item.notification.title}`,
      code: item.lastError ?? "UNKNOWN_DELIVERY_ERROR",
      occurredAt: item.updatedAt,
    })),
    ...recentCleanupFailures.map((item) => ({
      id: `cleanup-${item.id}`,
      label: `파일 정리 실패 · ${item.originalFilename}`,
      code: item.cleanupError ?? "UNKNOWN_CLEANUP_ERROR",
      occurredAt: item.lastCleanupAttemptAt ?? new Date(0),
    })),
  ].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime()).slice(0, 8);

  const summaryCards = [
    { label: "전체 사용자", value: users, detail: `오늘 가입 ${newUsersToday}명`, icon: Users },
    { label: "활성 조직", value: activeOrganizations, detail: "보관되지 않은 조직", icon: Building2 },
    { label: "실행 중 인스턴스", value: runningInstances, detail: "시작 중 포함", icon: Boxes },
    { label: "실패한 알림", value: failedDeliveries, detail: `대기 ${pendingDeliveries}건`, icon: XCircle },
    { label: "정리 실패 파일", value: cleanupFailures, detail: `미소비 업로드 ${pendingUploads}건`, icon: HardDrive },
    { label: "시스템 관리자", value: adminCount, detail: "최소 권한 운영", icon: ShieldCheck },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-indigo-600">운영 현황</p>
          <h1 className="mt-1 text-3xl font-black">시스템 관리자 대시보드</h1>
          <p className="mt-2 text-sm text-slate-500">민감한 비밀값과 사용자 제출 내용은 이 화면에 표시하지 않습니다.</p>
        </div>
        <StatusPill healthy>자체 인증 정상</StatusPill>
      </div>

      <section aria-label="서비스 요약" className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map(({ label, value, detail, icon: Icon }) => (
          <Card key={label} className="flex items-start justify-between gap-4">
            <div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{value.toLocaleString("ko-KR")}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></div>
            <span className="rounded-xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950"><Icon size={22} /></span>
          </Card>
        ))}
      </section>

      <section id="system-health" className="scroll-mt-24 pt-9">
        <h2 className="text-xl font-bold">시스템 상태</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="flex items-center gap-2"><Server className="text-indigo-600" size={20} /><h3 className="font-bold">애플리케이션</h3></div>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div><dt className="text-slate-500">서버 상태</dt><dd className="mt-1 font-bold text-emerald-600">정상</dd></div>
              <div><dt className="text-slate-500">Uptime</dt><dd className="mt-1 font-bold">{Math.floor(process.uptime() / 60).toLocaleString("ko-KR")}분</dd></div>
              <div><dt className="text-slate-500">Node.js</dt><dd className="mt-1 font-bold">{process.version}</dd></div>
              <div><dt className="text-slate-500">배포 버전</dt><dd className="mt-1 truncate font-mono text-xs font-bold">{process.env.GIT_COMMIT_SHA?.slice(0, 12) ?? "미설정"}</dd></div>
            </dl>
          </Card>
          <Card>
            <div className="flex items-center gap-2"><Database className="text-indigo-600" size={20} /><h3 className="font-bold">의존 서비스</h3></div>
            <div className="mt-5 space-y-4 text-sm">
              <div className="flex items-center justify-between gap-3"><span>PostgreSQL</span><StatusPill healthy>{databaseLatency}ms</StatusPill></div>
              <div className="flex items-center justify-between gap-3"><span>PostgreSQL Auth</span><StatusPill healthy>정상</StatusPill></div>
              <div className="flex items-center justify-between gap-3"><span>로컬 비공개 저장소</span><StatusPill healthy={localStorageConfigured}>{localStorageConfigured ? "설정됨" : "미설정"}</StatusPill></div>
              <div className="flex items-center justify-between gap-3"><span>Redis</span><span className="text-xs font-semibold text-slate-500">사용하지 않음 · DB 큐</span></div>
            </div>
          </Card>
        </div>
      </section>

      <section id="jobs" className="scroll-mt-24 pt-9">
        <h2 className="text-xl font-bold">작업 및 저장소</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Card><Activity className="text-indigo-600" /><p className="mt-4 text-sm text-slate-500">알림 전송 큐</p><p className="mt-1 text-2xl font-black">{pendingDeliveries}건 대기</p><p className="mt-2 text-xs text-red-600">실패 {failedDeliveries}건</p></Card>
          <Card><Clock3 className="text-indigo-600" /><p className="mt-4 text-sm text-slate-500">업로드 정리</p><p className="mt-1 text-2xl font-black">{pendingUploads}건 대기</p><p className="mt-2 text-xs text-red-600">정리 실패 {cleanupFailures}건</p></Card>
          <Card><HardDrive className="text-indigo-600" /><p className="mt-4 text-sm text-slate-500">업로드 용량</p><p className="mt-1 text-2xl font-black">{formatBytes(uploadStorage._sum.sizeBytes)}</p><p className="mt-2 text-xs text-slate-500">예약 {formatBytes(uploadStorage._sum.reservedBytes)}</p></Card>
        </div>
      </section>

      <section className="pt-9">
        <h2 className="text-xl font-bold">최근 오류</h2>
        <Card className="mt-4 overflow-hidden p-0">
          {recentErrors.length ? <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {recentErrors.map((error) => <li key={error.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{error.label}</p><p className="mt-1 font-mono text-xs text-red-600">{error.code}</p></div><time className="text-xs text-slate-500">{formatDateTime(error.occurredAt)}</time></li>)}
          </ul> : <div className="p-8 text-center"><CheckCircle2 className="mx-auto text-emerald-500" /><p className="mt-3 font-semibold">기록된 작업 오류가 없습니다.</p></div>}
        </Card>
      </section>

      <section id="audit-logs" className="scroll-mt-24 pt-9">
        <h2 className="text-xl font-bold">최근 감사 로그</h2>
        <Card className="mt-4 overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950"><tr><th className="px-4 py-3">시각</th><th className="px-4 py-3">작업자</th><th className="px-4 py-3">작업</th><th className="px-4 py-3">대상</th></tr></thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {recentAuditLogs.map((log) => <tr key={log.id.toString()}><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDateTime(log.createdAt)}</td><td className="px-4 py-3"><p className="font-semibold">{log.actor.name}</p><p className="text-xs text-slate-500">{log.actor.email}</p></td><td className="px-4 py-3 font-mono text-xs">{log.action}</td><td className="px-4 py-3 text-xs text-slate-500">{log.targetType}{log.targetId ? ` · ${log.targetId}` : ""}</td></tr>)}
            </tbody>
          </table>
          {!recentAuditLogs.length && <div className="p-8 text-center text-sm text-slate-500">감사 로그가 없습니다.</div>}
        </Card>
      </section>
    </div>
  );
}
