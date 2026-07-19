import { Bell, Building2, Home, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { logout } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { OrganizationSwitcher } from "./organization-switcher";

const navigation = [
  { href: "/dashboard", label: "홈", icon: Home },
  { href: "/notifications", label: "알림", icon: Bell },
  { href: "/organizations/new", label: "조직 만들기", icon: Building2 },
  { href: "/profile", label: "내 정보", icon: UserRound },
];

export function AppShell({
  userName,
  organizations,
  unreadNotifications,
  children,
}: {
  userName: string;
  organizations: { id: string; name: string }[];
  unreadNotifications: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 lg:block">
        <Link href="/dashboard" className="text-lg font-black tracking-wide text-indigo-600">FLOW TASK</Link>
        <nav className="mt-8 space-y-2">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">
              <Icon size={19} /> {label}{href === "/notifications" && unreadNotifications > 0 && <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{Math.min(unreadNotifications, 99)}</span>}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 pb-20 lg:pb-0">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 sm:px-8">
          <Link href="/dashboard" className="font-black tracking-wide text-indigo-600 lg:hidden">FLOW TASK</Link>
          <div className="ml-auto mr-3"><OrganizationSwitcher organizations={organizations} /></div>
          <p className="mr-3 hidden text-sm font-medium sm:block">{userName}</p>
          <form action={logout}>
            <Button type="submit" className="min-h-9 bg-transparent px-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="로그아웃">
              <LogOut size={19} />
            </Button>
          </form>
        </header>
        <main className="mx-auto max-w-6xl p-4 sm:p-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-white px-2 py-2 dark:border-slate-800 dark:bg-slate-950 lg:hidden">
        {navigation.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800">
            <Icon size={19} /> {label}{href === "/notifications" && unreadNotifications > 0 && <span className="absolute ml-5 -mt-7 min-w-5 rounded-full bg-red-500 px-1 text-center text-[10px] text-white">{Math.min(unreadNotifications, 99)}</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}
