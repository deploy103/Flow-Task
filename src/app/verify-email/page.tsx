import Link from "next/link";
import { resendVerificationEmail } from "@/features/auth/actions";
import { AuthNotice } from "@/components/auth/auth-notice";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; email?: string }>;
}) {
  const notice = await searchParams;
  return (
    <AuthShell title="이메일을 인증해 주세요" description="받은 메일의 인증 링크는 24시간 동안 한 번만 사용할 수 있습니다.">
      <AuthNotice error={notice.error} message={notice.message} />
      <form action={resendVerificationEmail} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          이메일
          <Input name="email" type="email" defaultValue={notice.email} autoComplete="email" required className="mt-2" />
        </label>
        <Button type="submit" className="w-full">인증 메일 다시 보내기</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500"><Link href="/login" className="font-semibold text-indigo-600">로그인으로 돌아가기</Link></p>
    </AuthShell>
  );
}
