"use client";

import { Bell, CalendarDays, CircleHelp, ClipboardList, LayoutDashboard, MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  getOrganizationIdFromPathname,
  isOrganizationNavigationItemActive,
} from "./navigation";

type OrganizationOption = { id: string; name: string };

const organizationSections = [
  { segment: "", label: "개요", icon: LayoutDashboard },
  { segment: "assignments", label: "과제", icon: ClipboardList },
  { segment: "announcements", label: "공지", icon: Bell },
  { segment: "calendar", label: "일정", icon: CalendarDays },
  { segment: "questions", label: "질문", icon: CircleHelp },
  { segment: "departments", label: "부서", icon: MessageSquare },
] as const;

export function OrganizationNavigation({ organizations }: { organizations: OrganizationOption[] }) {
  const pathname = usePathname();
  const organizationId = getOrganizationIdFromPathname(pathname);
  const organization = organizations.find(({ id }) => id === organizationId);

  if (!organization) return null;

  const organizationHref = `/organizations/${organization.id}`;

  return (
    <nav
      aria-label={`${organization.name} 메뉴`}
      className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 sm:px-8">
        {organizationSections.map(({ segment, label, icon: Icon }) => {
          const href = segment ? `${organizationHref}/${segment}` : organizationHref;
          const active = isOrganizationNavigationItemActive(pathname, href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium",
                active
                  ? "bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
              )}
              href={href}
              key={segment || "overview"}
            >
              <Icon aria-hidden="true" size={17} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
