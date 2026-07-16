"use client";

import { usePathname, useRouter } from "next/navigation";

type OrganizationOption = { id: string; name: string };

export function OrganizationSwitcher({ organizations }: { organizations: OrganizationOption[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeOrganization = organizations.find(({ id }) => pathname.includes(`/organizations/${id}`));

  if (!organizations.length) return null;

  return (
    <select
      aria-label="현재 조직 전환"
      value={activeOrganization?.id ?? ""}
      onChange={(event) => {
        const organizationId = event.target.value;
        router.push(organizationId ? `/organizations/${organizationId}` : "/dashboard");
      }}
      className="max-w-40 truncate rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900 sm:max-w-64"
    >
      <option value="">조직 선택</option>
      {organizations.map((organization) => (
        <option key={organization.id} value={organization.id}>{organization.name}</option>
      ))}
    </select>
  );
}
