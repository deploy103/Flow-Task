import { OrganizationIntegrationKind } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createOrganizationIntegration, deleteOrganizationIntegration } from "@/features/integration/actions";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { prisma } from "@/lib/prisma";

const LABELS: Record<OrganizationIntegrationKind, string> = { DISCORD_WEBHOOK: "Discord Webhook", GENERIC_WEBHOOK: "외부 API Webhook", EMAIL_RELAY: "이메일 릴레이 API" };

export default async function IntegrationsPage({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ organizationId }, query] = await Promise.all([params, searchParams]);
  await requireOrganizationAccess(organizationId, true);
  const integrations = await prisma.organizationIntegration.findMany({ where: { organizationId }, select: { id: true, kind: true, name: true, enabled: true, createdAt: true }, orderBy: { createdAt: "desc" } });
  return <div className="max-w-4xl"><h1 className="text-3xl font-bold">외부 서비스 연동</h1><p className="mt-2 text-sm text-slate-500">엔드포인트와 자격 증명은 서버에서 암호화되며 화면에 다시 표시되지 않습니다.</p>{query.error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">연동을 저장하지 못했습니다. HTTPS 주소와 서버 허용 호스트를 확인하세요.</p>}{query.success && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">연동 설정을 반영했습니다.</p>}<Card className="mt-6"><form action={createOrganizationIntegration} className="grid gap-4"><input name="organizationId" type="hidden" value={organizationId} /><label className="text-sm font-medium">종류<select className="mt-2 min-h-11 w-full rounded-xl border px-3 dark:bg-slate-900" name="kind">{Object.values(OrganizationIntegrationKind).map((kind) => <option key={kind} value={kind}>{LABELS[kind]}</option>)}</select></label><label className="text-sm font-medium">표시 이름<Input className="mt-2" maxLength={80} name="name" required /></label><label className="text-sm font-medium">HTTPS 엔드포인트<Input className="mt-2" maxLength={2048} name="endpoint" required type="url" /></label><label className="text-sm font-medium">Bearer 자격 증명 (선택)<Input autoComplete="new-password" className="mt-2" maxLength={500} name="secret" type="password" /></label><Button type="submit">암호화하여 연동 추가</Button></form></Card><div className="mt-5 space-y-3">{integrations.map((integration) => <Card key={integration.id}><div className="flex items-center justify-between gap-4"><div><strong>{integration.name}</strong><p className="text-xs text-slate-500">{LABELS[integration.kind]} · {integration.enabled ? "활성" : "비활성"} · 비밀값 숨김</p></div><form action={deleteOrganizationIntegration}><input name="organizationId" type="hidden" value={organizationId} /><input name="integrationId" type="hidden" value={integration.id} /><Button type="submit">삭제</Button></form></div></Card>)}</div></div>;
}
