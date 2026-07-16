import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flow Task",
  description: "동아리와 팀의 과제·조직 관리 서비스",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
