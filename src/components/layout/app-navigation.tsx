"use client";

import { Bell, Building2, Home, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isNavigationItemActive } from "./navigation";

const navigation = [
  { href: "/dashboard", label: "홈", icon: Home },
  { href: "/notifications", label: "알림", icon: Bell },
  { href: "/organizations/new", label: "조직 만들기", icon: Building2 },
  { href: "/profile", label: "내 정보", icon: UserRound },
];

export function AppNavigation({
  unreadNotifications,
  isSystemAdmin,
  mobile = false,
}: {
  unreadNotifications: number;
  isSystemAdmin: boolean;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const unreadLabel = `읽지 않은 알림 ${Math.min(unreadNotifications, 99)}개`;
  const items = isSystemAdmin
    ? [...navigation, { href: "/admin", label: "시스템 관리", icon: ShieldCheck }]
    : navigation;

  return items.map(({ href, label, icon: Icon }) => {
    const active = isNavigationItemActive(pathname, href);
    return (
      <Link
        aria-current={active ? "page" : undefined}
        className={cn(
          mobile
            ? "relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium"
            : "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium",
          active
            ? "bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200"
            : "hover:bg-slate-100 dark:hover:bg-slate-800",
        )}
        href={href}
        key={href}
      >
        <Icon aria-hidden="true" size={19} />
        {label}
        {href === "/notifications" && unreadNotifications > 0 && (
          <span
            aria-label={unreadLabel}
            className={cn(
              "rounded-full bg-red-500 px-1 text-center text-[10px] text-white",
              mobile ? "absolute ml-5 -mt-7 min-w-5" : "ml-auto px-2 py-0.5 text-xs",
            )}
          >
            {Math.min(unreadNotifications, 99)}
          </span>
        )}
      </Link>
    );
  });
}
