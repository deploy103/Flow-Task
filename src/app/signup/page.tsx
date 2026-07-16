import Link from "next/link";
import { signUp } from "@/features/auth/actions";
import { AuthNotice } from "@/components/auth/auth-notice";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const notice = await searchParams;
  return (
    <AuthShell title="계정을 만들어 볼까요?" description="이름과 학교 정보를 입력하면 바로 시작할 수 있어요.">
      <AuthNotice {...notice} />
      <form action={signUp} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">이름<Input name="name" required minLength={2} maxLength={50} autoComplete="name" className="mt-2" /></label>
        <label className="block text-sm font-medium">학번 <span className="text-slate-400">(선택)</span><Input name="studentNumber" maxLength={30} className="mt-2" /></label>
        <label className="block text-sm font-medium">이메일<Input name="email" type="email" required autoComplete="email" className="mt-2" /></label>
        <label className="block text-sm font-medium">비밀번호<Input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className="mt-2" /></label>
        <Button type="submit" className="w-full">회원가입</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">이미 계정이 있나요? <Link href="/login" className="font-semibold text-indigo-600">로그인</Link></p>
    </AuthShell>
  );
}
