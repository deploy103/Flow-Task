import { LogOut } from "lucide-react";
import Link from "next/link";
import { logout } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { AppNavigation } from "./app-navigation";
import { OrganizationSwitcher } from "./organization-switcher";

export function AppShell({
  userName,
  organizations,
  unreadNotifications,
  isSystemAdmin,
  children,
}: {
  userName: string;
  organizations: { id: string; name: string }[];
  unreadNotifications: number;
  isSystemAdmin: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <a className="sr-only fixed left-4 top-4 z-50 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white focus:not-sr-only" href="#main-content">본문 바로가기</a>
      <aside className="hidden border-r border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 lg:block">
        <Link href="/dashboard" className="text-lg font-black tracking-wide text-indigo-600">FLOW TASK</Link>
        <nav aria-label="주요 메뉴" className="mt-8 space-y-2">
          <AppNavigation isSystemAdmin={isSystemAdmin} unreadNotifications={unreadNotifications} />
        </nav>
      </aside>
      <div className="min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
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
        <main className="mx-auto max-w-6xl p-4 sm:p-8" id="main-content" tabIndex={-1}>{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-24 text-right sm:px-8 lg:pb-8">
          <Link href="/privacy" className="text-xs text-slate-500 underline underline-offset-4">개인정보처리방침</Link>
        </footer>
      </div>
      <nav aria-label="주요 메뉴" className={`fixed inset-x-0 bottom-0 z-20 grid border-t border-slate-200 bg-white px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-950 lg:hidden ${isSystemAdmin ? "grid-cols-5" : "grid-cols-4"}`}>
        <AppNavigation isSystemAdmin={isSystemAdmin} mobile unreadNotifications={unreadNotifications} />
      </nav>
    </div>
  );
}
