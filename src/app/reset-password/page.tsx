import Link from "next/link";
import { resetPassword } from "@/features/auth/actions";
import { AuthNotice } from "@/components/auth/auth-notice";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const notice = await searchParams;
  const hasToken = /^[A-Za-z0-9_-]{43}$/.test(notice.token ?? "");
  return (
    <AuthShell title="새 비밀번호 설정" description="다른 서비스에서 사용하지 않는 비밀번호를 입력해 주세요.">
      <AuthNotice error={hasToken ? notice.error : "invalid_or_expired_token"} />
      {hasToken ? (
        <form action={resetPassword} className="mt-6 space-y-4">
          <input type="hidden" name="token" value={notice.token} />
          <label className="block text-sm font-medium">새 비밀번호<Input name="password" type="password" minLength={8} maxLength={128} autoComplete="new-password" required className="mt-2" /></label>
          <label className="block text-sm font-medium">새 비밀번호 확인<Input name="passwordConfirmation" type="password" minLength={8} maxLength={128} autoComplete="new-password" required className="mt-2" /></label>
          <Button type="submit" className="w-full">비밀번호 변경하기</Button>
        </form>
      ) : (
        <p className="mt-6 text-center text-sm"><Link href="/forgot-password" className="font-semibold text-indigo-600">새 재설정 링크 요청하기</Link></p>
      )}
    </AuthShell>
  );
}
