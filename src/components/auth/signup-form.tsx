"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signUp, type AuthFormState } from "@/features/auth/actions";
import { AuthNotice } from "@/components/auth/auth-notice";
import { BirthDateField } from "@/components/auth/birth-date-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRIVACY_POLICY_VERSION } from "@/constants/privacy";

const INITIAL_STATE: AuthFormState = {};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, INITIAL_STATE);
  const [values, setValues] = useState({ name: "", birthDate: "", studentNumber: "", email: "", password: "", passwordConfirmation: "" });
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const update = (field: keyof typeof values, value: string) => setValues((current) => ({ ...current, [field]: value }));

  return (
    <>
      <AuthNotice error={state.error} />
      <form action={formAction} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">이름<Input name="name" required minLength={2} maxLength={50} autoComplete="name" className="mt-2" value={values.name} onChange={(event) => update("name", event.target.value)} /></label>
        <BirthDateField onChange={(value) => update("birthDate", value)} />
        <label className="block text-sm font-medium">학번 <span className="text-slate-400">(선택)</span><Input name="studentNumber" maxLength={30} className="mt-2" value={values.studentNumber} onChange={(event) => update("studentNumber", event.target.value)} /></label>
        <label className="block text-sm font-medium">이메일<Input name="email" type="email" required autoComplete="email" className="mt-2" value={values.email} onChange={(event) => update("email", event.target.value)} /></label>
        <label className="block text-sm font-medium">비밀번호<Input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className="mt-2" value={values.password} onChange={(event) => update("password", event.target.value)} /></label>
        <label className="block text-sm font-medium">비밀번호 확인<Input name="passwordConfirmation" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className="mt-2" value={values.passwordConfirmation} onChange={(event) => update("passwordConfirmation", event.target.value)} /></label>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
          <p className="font-semibold text-slate-900 dark:text-white">개인정보 수집·이용 안내</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>항목: 이름, 이메일, 생년월일, 단방향 해시된 인증정보, 선택 입력한 학번</li>
            <li>목적: 회원 식별, 연령 확인, 로그인 및 Flow Task 서비스 제공, 보안 사고 대응</li>
            <li>기간: 회원 탈퇴 처리 완료 시까지. 법령상 의무가 있으면 해당 기간까지</li>
          </ul>
          <p className="mt-2">동의를 거부할 수 있으나 필수 정보 처리에 동의하지 않으면 가입할 수 없습니다. 자세한 내용은 <Link href="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 underline">개인정보처리방침</Link>에서 확인하세요.</p>
          <p className="mt-1 text-slate-500">적용 방침 버전: {PRIVACY_POLICY_VERSION}</p>
        </div>
        <label className="flex items-start gap-3 text-sm font-medium"><input name="privacyConsent" type="checkbox" required className="mt-1 size-4" checked={privacyConsent} onChange={(event) => setPrivacyConsent(event.target.checked)} /><span><span className="text-indigo-600">[필수]</span> 개인정보 수집·이용에 동의합니다.</span></label>
        <Button type="submit" className="w-full" disabled={pending}>{pending ? "가입 처리 중..." : "회원가입"}</Button>
      </form>
    </>
  );
}
