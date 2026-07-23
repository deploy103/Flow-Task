import Link from "next/link";
import type { Metadata } from "next";
import { PRIVACY_POLICY_VERSION } from "@/constants/privacy";
import { PRIVACY_POLICY_SECTIONS } from "@/features/privacy/policy";

export const metadata: Metadata = {
  title: "개인정보처리방침 | Flow Task",
  description: "Flow Task 개인정보 처리 항목, 목적, 보유기간과 이용자 권리",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-12">
      <Link href="/" className="text-sm font-bold text-indigo-600">FLOW TASK</Link>
      <h1 className="mt-5 text-3xl font-bold">개인정보처리방침</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">Flow Task는 실제 서비스 구조에 맞춰 필요한 최소한의 개인정보만 처리합니다. 시행일 및 버전: {PRIVACY_POLICY_VERSION}</p>
      <div className="mt-8 space-y-8">
        {PRIVACY_POLICY_SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-xl font-bold">{section.title}</h2>
            <div className="mt-3 space-y-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {section.content.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </section>
        ))}
      </div>
      <Link href="/signup" className="mt-10 inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 font-semibold text-white">회원가입으로 돌아가기</Link>
    </main>
  );
}
