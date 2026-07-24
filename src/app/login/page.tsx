import Link from "next/link";
import { AuthNotice } from "@/components/auth/auth-notice";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const notice = await searchParams;
  return (
    <AuthShell title="다시 만나 반가워요" description="해야 할 일과 조직 소식을 한곳에서 확인하세요.">
      <AuthNotice {...notice} />
      <LoginForm />
      <div className="mt-4 text-right"><Link href="/forgot-password" className="text-sm font-semibold text-indigo-600">비밀번호를 잊으셨나요?</Link></div>
      <p className="mt-6 text-center text-sm text-slate-500">
        처음이신가요? <Link href="/signup" className="font-semibold text-indigo-600">회원가입</Link>
      </p>
    </AuthShell>
  );
}
