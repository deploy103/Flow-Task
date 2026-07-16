import Link from "next/link";
import { login } from "@/features/auth/actions";
import { AuthNotice } from "@/components/auth/auth-notice";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const notice = await searchParams;
  return (
    <AuthShell title="다시 만나 반가워요" description="해야 할 일과 조직 소식을 한곳에서 확인하세요.">
      <AuthNotice {...notice} />
      <form action={login} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          이메일
          <Input name="email" type="email" autoComplete="email" required className="mt-2" />
        </label>
        <label className="block text-sm font-medium">
          비밀번호
          <Input name="password" type="password" autoComplete="current-password" minLength={8} required className="mt-2" />
        </label>
        <Button type="submit" className="w-full">로그인</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        처음이신가요? <Link href="/signup" className="font-semibold text-indigo-600">회원가입</Link>
      </p>
    </AuthShell>
  );
}
