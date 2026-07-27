export function isNavigationItemActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/dashboard" || href === "/organizations/new") return false;
  return pathname.startsWith(`${href}/`);
}

export function getOrganizationIdFromPathname(pathname: string) {
  const [, section, organizationId] = pathname.split("/");
  if (section !== "organizations" || !organizationId || organizationId === "new") return null;
  return organizationId;
}

export function isOrganizationNavigationItemActive(pathname: string, href: string) {
  if (pathname === href) return true;
  const organizationId = getOrganizationIdFromPathname(href);
  if (!organizationId || href === `/organizations/${organizationId}`) return false;
  return pathname.startsWith(`${href}/`);
}
