import Link from "next/link";
import { AuthNotice } from "@/components/auth/auth-notice";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const notice = await searchParams;
  return (
    <AuthShell title="계정을 만들어 볼까요?" description="기본 정보를 입력하고 이메일을 인증하면 시작할 수 있어요.">
      <AuthNotice {...notice} />
      <SignupForm />
      <p className="mt-6 text-center text-sm text-slate-500">이미 계정이 있나요? <Link href="/login" className="font-semibold text-indigo-600">로그인</Link></p>
    </AuthShell>
  );
}
