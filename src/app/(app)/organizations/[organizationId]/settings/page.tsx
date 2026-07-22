import Image from "next/image";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MAX_ORGANIZATION_LOGO_BYTES, ORGANIZATION_LOGO_MIME_TYPES } from "@/constants/organization";
import { updateOrganizationSettings } from "@/features/organization/actions";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { prisma } from "@/lib/prisma";

export default async function OrganizationSettingsPage({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: Promise<{ error?: string; message?: string }> }) {
  const { organizationId } = await params;
  const notice = await searchParams;
  await requireOrganizationAccess(organizationId, true);
  const organization = await prisma.organization.findFirst({ where: { id: organizationId, archivedAt: null } });
  if (!organization) notFound();
  const accept = Object.values(ORGANIZATION_LOGO_MIME_TYPES).join(",");

  return <div className="max-w-2xl"><BackLink href={`/organizations/${organizationId}`} label="조직 홈"/><h1 className="text-3xl font-bold">조직 설정</h1><p className="mt-2 text-slate-500">조직 이름, 소개와 구성원에게 표시할 로고를 관리하세요.</p>
    {notice.error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">설정을 저장하지 못했습니다. 입력과 로고 파일을 확인해 주세요.</p>}{notice.message === "updated" && <p role="status" className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700">조직 설정을 저장했습니다.</p>}
    <Card className="mt-6"><form action={updateOrganizationSettings} className="space-y-5"><input type="hidden" name="organizationId" value={organizationId}/>
      <label className="block text-sm font-medium">조직 이름<Input name="name" defaultValue={organization.name} required minLength={2} maxLength={80} className="mt-2"/></label>
      <label className="block text-sm font-medium">조직 소개<textarea name="description" defaultValue={organization.description ?? ""} maxLength={500} rows={5} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"/></label>
      {organization.logoStoragePath && <div><p className="text-sm font-medium">현재 로고</p><Image src={`/api/organizations/${organizationId}/logo`} alt={`${organization.name} 로고`} width={96} height={96} unoptimized className="mt-2 size-24 rounded-2xl border object-cover"/><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="removeLogo"/> 현재 로고 삭제</label></div>}
      <label className="block text-sm font-medium">새 로고 <span className="text-slate-400">(선택)</span><Input type="file" name="logo" accept={accept} className="mt-2"/><span className="mt-1 block text-xs font-normal text-slate-500">PNG, JPEG, WebP · 최대 {MAX_ORGANIZATION_LOGO_BYTES / 1024}KB</span></label>
      <Button type="submit">설정 저장</Button>
    </form></Card></div>;
}
