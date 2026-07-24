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
        <Button type="submit" className="w-full" disabled={pending}>{pending ? "확인 중..." : "로그인"}</Button>
      </form>
    </>
  );
}
