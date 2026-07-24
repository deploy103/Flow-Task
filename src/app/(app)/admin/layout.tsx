import { Activity, Building2, Database, FileClock, LayoutDashboard, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { requireSystemAdministrator } from "@/features/auth/guards";

const adminNavigation = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/organizations", label: "전체 동아리", icon: Building2 },
  { href: "/admin/users", label: "사용자", icon: Users },
  { href: "/admin#system-health", label: "시스템 상태", icon: Activity },
  { href: "/admin#jobs", label: "작업 상태", icon: Database },
  { href: "/admin#audit-logs", label: "감사 로그", icon: FileClock },
];

export default async function SystemAdminLayout({ children }: { children: React.ReactNode }) {
  await requireSystemAdministrator();

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
        <div className="flex items-center gap-2 text-sm font-bold text-indigo-700 dark:text-indigo-300">
          <ShieldCheck size={18} /> 시스템 관리자 전용
        </div>
        <nav aria-label="시스템 관리자 메뉴" className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {adminNavigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:text-indigo-600 dark:bg-slate-900 dark:text-slate-200">
              <Icon size={16} /> {label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
