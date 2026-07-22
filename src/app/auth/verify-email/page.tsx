import Link from "next/link";
import { confirmEmailVerification } from "@/features/auth/actions";
import { AuthNotice } from "@/components/auth/auth-notice";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export default async function EmailVerificationConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const hasToken = /^[A-Za-z0-9_-]{43}$/.test(token);

  return (
    <AuthShell title="이메일 인증 확인" description="아래 버튼을 눌러야 이메일 인증이 완료됩니다.">
      {!hasToken && <AuthNotice error="invalid_or_expired_verification" />}
      {hasToken ? (
        <form action={confirmEmailVerification} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <Button type="submit" className="w-full">이메일 인증 완료하기</Button>
        </form>
      ) : (
        <p className="mt-6 text-center text-sm"><Link href="/verify-email" className="font-semibold text-indigo-600">인증 메일 다시 요청하기</Link></p>
      )}
    </AuthShell>
  );
}
