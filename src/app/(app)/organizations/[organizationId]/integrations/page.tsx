import { OrganizationIntegrationKind } from "@prisma/client";
import { ArrowRight, CheckCircle2, KeyRound, Mail, MessageCircle, ShieldCheck, Trash2, Webhook } from "lucide-react";
import Link from "next/link";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  MAX_INTEGRATION_ENDPOINT_LENGTH,
  MAX_INTEGRATION_NAME_LENGTH,
  MAX_INTEGRATION_SECRET_LENGTH,
  MIN_INTEGRATION_NAME_LENGTH,
} from "@/constants/integration";
import { createOrganizationIntegration, deleteOrganizationIntegration } from "@/features/integration/actions";
import { INTEGRATION_ERROR_MESSAGES, INTEGRATION_GUIDES, parseIntegrationKind } from "@/features/integration/catalog";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { formatKoreanDateTime } from "@/lib/date";
import { getIntegrationEnvironment } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const KIND_ICONS = {
  [OrganizationIntegrationKind.DISCORD_WEBHOOK]: MessageCircle,
  [OrganizationIntegrationKind.GENERIC_WEBHOOK]: Webhook,
  [OrganizationIntegrationKind.EMAIL_RELAY]: Mail,
};

export default async function IntegrationsPage({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: Promise<{ error?: string; success?: string; kind?: string }> }) {
  const [{ organizationId }, query] = await Promise.all([params, searchParams]);
  await requireOrganizationAccess(organizationId, true);
  const integrations = await prisma.organizationIntegration.findMany({ where: { organizationId }, select: { id: true, kind: true, name: true, enabled: true, createdAt: true }, orderBy: { createdAt: "desc" } });
  const selectedKind = parseIntegrationKind(query.kind);
  const selectedGuide = selectedKind ? INTEGRATION_GUIDES[selectedKind] : null;
  let serverReady = true;
  let allowedHosts: string[] = [];
  try { allowedHosts = getIntegrationEnvironment().allowedHosts; } catch { serverReady = false; }
  const selectedReady = serverReady && (selectedKind === OrganizationIntegrationKind.DISCORD_WEBHOOK || allowedHosts.length > 0);
  const errorMessage = query.error ? INTEGRATION_ERROR_MESSAGES[query.error] ?? INTEGRATION_ERROR_MESSAGES.create_failed : null;

  return <div className="max-w-5xl">
    <BackLink href={`/organizations/${organizationId}`} label="조직 홈" />
    <h1 className="text-3xl font-bold">외부 서비스 연동</h1>
    <p className="mt-2 text-slate-500">기술 용어를 모르더라도 아래 순서대로 진행하면 됩니다. 입력한 주소와 토큰은 암호화되며 다시 표시되지 않습니다.</p>
    {errorMessage && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{errorMessage}</p>}
    {query.success && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{query.success === "deleted" ? "연동을 삭제했습니다." : "연동을 안전하게 저장했습니다."}</p>}

    <section className="mt-8" aria-labelledby="integration-type-heading">
      <p className="text-sm font-bold text-indigo-600">1단계</p>
      <h2 id="integration-type-heading" className="mt-1 text-xl font-bold">어디에 알림을 보낼지 선택하세요</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {Object.values(OrganizationIntegrationKind).map((kind) => {
          const guide = INTEGRATION_GUIDES[kind];
          const Icon = KIND_ICONS[kind];
          const selected = selectedKind === kind;
          return <Link key={kind} href={`/organizations/${organizationId}/integrations?kind=${kind}`} aria-current={selected ? "step" : undefined} className={`rounded-2xl border p-5 transition hover:border-indigo-400 hover:shadow-sm ${selected ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100 dark:bg-indigo-950" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}>
            <div className="flex items-center justify-between"><span className="rounded-xl bg-indigo-100 p-2 text-indigo-700 dark:bg-indigo-900"><Icon /></span>{guide.recommended && <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">가장 쉬움</span>}</div>
            <h3 className="mt-4 font-bold">{guide.title}</h3><p className="mt-2 text-sm text-slate-500">{guide.shortDescription}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600">선택하기 <ArrowRight size={16} /></span>
          </Link>;
        })}
      </div>
    </section>

    {selectedKind && selectedGuide && <>
      <section className="mt-8" aria-labelledby="integration-preparation-heading">
        <p className="text-sm font-bold text-indigo-600">2단계</p>
        <h2 id="integration-preparation-heading" className="mt-1 text-xl font-bold">필요한 값을 준비하세요</h2>
        <Card className="mt-4"><p className="text-sm text-slate-600 dark:text-slate-300">{selectedGuide.purpose}</p><ol className="mt-5 space-y-4">{selectedGuide.steps.map((step, index) => <li key={step} className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">{index + 1}</span><span className="pt-1 text-sm">{step}</span></li>)}</ol></Card>
        <Card className={`mt-4 ${selectedReady ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950" : "border-amber-200 bg-amber-50 dark:bg-amber-950"}`}>
          <div className="flex gap-3">{selectedReady ? <CheckCircle2 className="shrink-0 text-emerald-600" /> : <ShieldCheck className="shrink-0 text-amber-600" />}<div><h3 className="font-bold">{selectedReady ? "서버 준비 완료" : "서버 관리자 설정 필요"}</h3><p className="mt-1 text-sm">{!serverReady ? "암호화 설정이 아직 없습니다. 서버 관리자가 INTEGRATION_ENCRYPTION_KEY를 설정해야 합니다." : selectedKind !== OrganizationIntegrationKind.DISCORD_WEBHOOK && allowedHosts.length === 0 ? "허용된 외부 주소가 없습니다. 서버 관리자가 EXTERNAL_SERVICE_ALLOWED_HOSTS를 설정해야 합니다." : selectedKind === OrganizationIntegrationKind.DISCORD_WEBHOOK ? "Discord 공식 Webhook 주소를 바로 등록할 수 있습니다." : `서버가 허용한 주소: ${allowedHosts.join(", ")}`}</p></div></div>
        </Card>
      </section>

      <section className="mt-8" aria-labelledby="integration-form-heading">
        <p className="text-sm font-bold text-indigo-600">3단계</p>
        <h2 id="integration-form-heading" className="mt-1 text-xl font-bold">준비한 값을 입력하세요</h2>
        <Card className="mt-4"><form action={createOrganizationIntegration} className="grid gap-5"><input name="organizationId" type="hidden" value={organizationId} /><input name="kind" type="hidden" value={selectedKind} />
          <label className="text-sm font-medium">표시 이름<span className="mt-1 block text-xs font-normal text-slate-500">나중에 알아보기 쉽게 지으세요. 예: 보안팀 Discord</span><Input className="mt-2" minLength={MIN_INTEGRATION_NAME_LENGTH} maxLength={MAX_INTEGRATION_NAME_LENGTH} name="name" required placeholder="예: 공지 알림 채널" /></label>
          <label className="text-sm font-medium">{selectedGuide.endpointLabel}<span className="mt-1 block text-xs font-normal text-slate-500">{selectedGuide.endpointHelp}</span><Input className="mt-2" maxLength={MAX_INTEGRATION_ENDPOINT_LENGTH} name="endpoint" required type="url" placeholder={selectedGuide.endpointPlaceholder} /></label>
          {selectedGuide.usesSecret && <label className="text-sm font-medium"><span className="inline-flex items-center gap-1"><KeyRound size={16} /> 비밀 토큰 (선택)</span><span className="mt-1 block text-xs font-normal text-slate-500">연동 서비스가 Bearer 토큰을 제공했을 때만 입력하세요. 저장 후에는 다시 볼 수 없습니다.</span><Input autoComplete="new-password" className="mt-2" maxLength={MAX_INTEGRATION_SECRET_LENGTH} name="secret" type="password" /></label>}
          <Button type="submit" disabled={!selectedReady}>암호화하여 연동 저장</Button>
        </form></Card>
      </section>
    </>}

    <section className="mt-10" aria-labelledby="saved-integrations-heading">
      <p className="text-sm font-bold text-indigo-600">4단계</p>
      <h2 id="saved-integrations-heading" className="mt-1 text-xl font-bold">저장된 연동을 확인하세요</h2>
      <p className="mt-2 text-sm text-slate-500">주소와 비밀 토큰은 보안을 위해 보여주지 않습니다. 값을 바꾸려면 기존 연동을 삭제하고 다시 등록하세요. 삭제하면 해당 알림 전송이 즉시 중단됩니다.</p>
      <div className="mt-4 space-y-3">{integrations.map((integration) => <Card key={integration.id}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><strong>{integration.name}</strong><p className="mt-1 text-xs text-slate-500">{INTEGRATION_GUIDES[integration.kind].title} · {integration.enabled ? "사용 중" : "사용 안 함"} · {formatKoreanDateTime(integration.createdAt)} 등록 · 주소/비밀값 숨김</p></div><form action={deleteOrganizationIntegration}><input name="organizationId" type="hidden" value={organizationId} /><input name="integrationId" type="hidden" value={integration.id} /><Button className="gap-2 bg-red-600 hover:bg-red-700" type="submit"><Trash2 size={16} /> 삭제</Button></form></div></Card>)}{integrations.length === 0 && <Card><p className="text-sm text-slate-500">아직 저장된 연동이 없습니다. 위에서 종류를 선택해 시작하세요.</p></Card>}</div>
    </section>
  </div>;
}
