import Link from "next/link";
import { signUp } from "@/features/auth/actions";
import { AuthNotice } from "@/components/auth/auth-notice";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const notice = await searchParams;
  return (
    <AuthShell title="계정을 만들어 볼까요?" description="기본 정보를 입력하고 이메일을 인증하면 시작할 수 있어요.">
      <AuthNotice {...notice} />
      <form action={signUp} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">이름<Input name="name" required minLength={2} maxLength={50} autoComplete="name" className="mt-2" /></label>
        <label className="block text-sm font-medium">생년월일<Input name="birthDate" type="date" required autoComplete="bday" className="mt-2" /><span className="mt-1 block text-xs font-normal text-slate-500">나이는 생년월일을 기준으로 자동 계산됩니다.</span></label>
        <label className="block text-sm font-medium">학번 <span className="text-slate-400">(선택)</span><Input name="studentNumber" maxLength={30} className="mt-2" /></label>
        <label className="block text-sm font-medium">이메일<Input name="email" type="email" required autoComplete="email" className="mt-2" /></label>
        <label className="block text-sm font-medium">비밀번호<Input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className="mt-2" /></label>
        <label className="block text-sm font-medium">비밀번호 확인<Input name="passwordConfirmation" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className="mt-2" /></label>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
          <p className="font-semibold text-slate-900 dark:text-white">개인정보 수집·이용 안내</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>항목: 이름, 이메일, 생년월일, 단방향 해시된 인증정보, 선택 입력한 학번</li>
            <li>목적: 회원 식별, 연령 확인, 로그인 및 Flow Task 서비스 제공, 보안 사고 대응</li>
            <li>기간: 회원 탈퇴 처리 완료 시까지. 법령상 의무가 있으면 해당 기간까지</li>
          </ul>
          <p className="mt-2">동의를 거부할 수 있으나 필수 정보 처리에 동의하지 않으면 가입할 수 없습니다. 자세한 내용은 <Link href="/privacy" target="_blank" className="font-semibold text-indigo-600 underline">개인정보처리방침</Link>에서 확인하세요.</p>
        </div>
        <label className="flex items-start gap-3 text-sm font-medium"><input name="privacyConsent" type="checkbox" required className="mt-1 size-4" /><span><span className="text-indigo-600">[필수]</span> 개인정보 수집·이용에 동의합니다.</span></label>
        <Button type="submit" className="w-full">회원가입</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">이미 계정이 있나요? <Link href="/login" className="font-semibold text-indigo-600">로그인</Link></p>
    </AuthShell>
  );
}
