import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  metadataBase: new URL("https://flow.mvtp.cloud"),
  title: "Flow Task",
  description: "동아리와 팀의 과제·조직 관리 서비스",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // A per-request CSP nonce cannot be embedded into prerendered HTML.
  await connection();
  return (
    <html lang="ko">
      <body><PwaRegister />{children}</body>
    </html>
  );
}
