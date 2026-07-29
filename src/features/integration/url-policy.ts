import { isIP } from "node:net";
import { OrganizationIntegrationKind } from "@prisma/client";
import { isPublicNetworkAddress } from "@/lib/outbound-http";

const BLOCKED_NAMES = new Set(["localhost", "localhost.localdomain"]);

function privateLiteral(hostname: string) {
  const literal = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  return isIP(literal) !== 0 && !isPublicNetworkAddress(literal);
}

export function validateIntegrationUrl(raw: string, kind: OrganizationIntegrationKind, allowedHosts: string[]) {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port || BLOCKED_NAMES.has(url.hostname) || privateLiteral(url.hostname)) return null;
  const hostname = url.hostname.toLowerCase();
  if (kind === OrganizationIntegrationKind.DISCORD_WEBHOOK) {
    if (hostname !== "discord.com" || !url.pathname.startsWith("/api/webhooks/")) return null;
  } else if (!allowedHosts.includes(hostname)) return null;
  url.hash = "";
  return url.toString();
}
