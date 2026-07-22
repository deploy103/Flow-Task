export function isNavigationItemActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/dashboard" || href === "/organizations/new") return false;
  return pathname.startsWith(`${href}/`);
}
