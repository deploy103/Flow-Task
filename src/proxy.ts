import { NextResponse, type NextRequest } from "next/server";
import { buildContentSecurityPolicy, createContentSecurityNonce } from "@/lib/content-security-policy";

export function proxy(request: NextRequest) {
  const nonce = createContentSecurityNonce();
  const policy = buildContentSecurityPolicy(nonce, process.env.NODE_ENV === "production");
  const requestHeaders = new Headers(request.headers);

  // Always replace inbound values so a client cannot choose a nonce that the
  // rendering pipeline later trusts.
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sw.js|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
