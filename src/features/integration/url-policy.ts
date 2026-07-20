import { isIP } from "node:net";
import { OrganizationIntegrationKind } from "@prisma/client";

const BLOCKED_NAMES = new Set(["localhost", "localhost.localdomain"]);

function privateLiteral(hostname: string) {
  if (isIP(hostname) === 4) { const [a, b] = hostname.split(".").map(Number); return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168); }
  if (isIP(hostname) === 6) return hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:");
  return false;
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
