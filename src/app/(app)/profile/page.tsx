import { updateProfile } from "@/features/auth/actions";
import { requireAuthenticatedUser } from "@/features/auth/guards";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculateAge, formatDateOnly } from "@/features/auth/birth-date";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const user = await requireAuthenticatedUser();
  const notice = await searchParams;
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold">내 정보</h1><p className="mt-2 text-slate-500">조직에서 사용할 기본 정보를 관리하세요.</p>
      <Card className="mt-6">
        {notice.error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">입력 내용을 확인해 주세요.</p>}
        {notice.message === "updated" && <p className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">프로필을 저장했습니다.</p>}
        <form action={updateProfile} className="space-y-4">
          <label className="block text-sm font-medium">이메일<Input value={user.email} disabled className="mt-2 opacity-70" /></label>
          <label className="block text-sm font-medium">이름<Input name="name" defaultValue={user.name} required minLength={2} maxLength={50} className="mt-2" /></label>
          <label className="block text-sm font-medium">생년월일 <span className="text-slate-400">(기존 계정은 선택)</span><Input name="birthDate" type="date" defaultValue={user.birthDate ? formatDateOnly(user.birthDate) : ""} className="mt-2" />{user.birthDate && <span className="mt-1 block text-xs font-normal text-slate-500">현재 만 {calculateAge(user.birthDate)}세</span>}</label>
          <label className="block text-sm font-medium">학번<Input name="studentNumber" defaultValue={user.studentNumber ?? ""} maxLength={30} className="mt-2" /></label>
          <Button type="submit">변경사항 저장</Button>
        </form>
      </Card>
    </div>
  );
}
