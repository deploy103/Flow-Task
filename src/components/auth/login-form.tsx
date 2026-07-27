"use client";

import { useActionState, useState } from "react";
import { login, type AuthFormState } from "@/features/auth/actions";
import { AuthNotice } from "@/components/auth/auth-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const INITIAL_STATE: AuthFormState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, INITIAL_STATE);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  return (
    <>
      <AuthNotice error={state.error} />
      <form action={formAction} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          이메일
          <Input name="email" type="email" autoComplete="email" required className="mt-2" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          비밀번호
          <Input name="password" type="password" autoComplete="current-password" minLength={8} required className="mt-2" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label className="flex items-start gap-3 text-sm font-medium">
          <input name="rememberMe" type="checkbox" className="mt-0.5 size-4" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
          <span>로그인 상태 유지 <span className="block text-xs font-normal text-slate-500">이 기기에서 30일 동안 유지됩니다.</span></span>
        </label>
        <p className="text-xs text-slate-500">비밀번호 저장은 브라우저의 안전한 비밀번호 관리자에서 선택할 수 있습니다.</p>
        <Button type="submit" className="w-full" disabled={pending}>{pending ? "확인 중..." : "로그인"}</Button>
      </form>
    </>
  );
}
