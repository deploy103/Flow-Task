import Link from "next/link";
import { requestPasswordReset } from "@/features/auth/actions";
import { AuthNotice } from "@/components/auth/auth-notice";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const notice = await searchParams;
  return (
    <AuthShell title="비밀번호 찾기" description="가입한 이메일로 30분 동안 유효한 재설정 링크를 보내드립니다.">
      <AuthNotice {...notice} />
      <form action={requestPasswordReset} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          이메일
          <Input name="email" type="email" autoComplete="email" required className="mt-2" />
        </label>
        <Button type="submit" className="w-full">재설정 메일 보내기</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500"><Link href="/login" className="font-semibold text-indigo-600">로그인으로 돌아가기</Link></p>
    </AuthShell>
  );
}
