import { createOrganization } from "@/features/organization/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BackLink } from "@/components/ui/back-link";

export default async function NewOrganizationPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="max-w-2xl">
      <BackLink href="/dashboard" label="대시보드" />
      <p className="text-sm font-semibold text-indigo-600">새로운 공간</p>
      <h1 className="mt-1 text-3xl font-bold">조직 만들기</h1>
      <p className="mt-2 text-slate-500">동아리, 학생회 또는 프로젝트팀을 위한 공간을 만드세요.</p>
      <Card className="mt-6">
        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">조직 이름과 설명을 확인해 주세요.</p>}
        <form action={createOrganization} className="space-y-5">
          <label className="block text-sm font-medium">조직 이름<Input name="name" required minLength={2} maxLength={80} className="mt-2" placeholder="예: HSOC" /></label>
          <label className="block text-sm font-medium">소개 <span className="text-slate-400">(선택)</span><textarea name="description" maxLength={500} rows={5} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder="이 조직은 어떤 활동을 하나요?" /></label>
          <Button type="submit">조직 만들기</Button>
        </form>
      </Card>
    </div>
  );
}
