import type { Metadata } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  metadataBase: new URL("https://flow.mvtp.cloud"),
  title: "Flow Task",
  description: "동아리와 팀의 과제·조직 관리 서비스",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body><PwaRegister />{children}</body>
    </html>
  );
}
