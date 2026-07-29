import { ChallengeConnectionProtocol, OrganizationIntegrationKind } from "@prisma/client";
import { z } from "zod";
import { validateIntegrationUrl } from "@/features/integration/url-policy";
import { getInstanceProviderEnvironment } from "@/lib/env";
import { fetchPublicNetwork, readBoundedJsonResponse } from "@/lib/outbound-http";

const responseSchema = z.object({ providerReference: z.string().min(1).max(180), host: z.string().regex(/^(?=.{1,253}$)(?![-.])(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/), port: z.number().int().min(1).max(65_535), protocol: z.enum(Object.values(ChallengeConnectionProtocol)) });

function provider() {
  const environment = getInstanceProviderEnvironment();
  const endpoint = validateIntegrationUrl(environment.INSTANCE_PROVIDER_URL, OrganizationIntegrationKind.GENERIC_WEBHOOK, environment.allowedHosts);
  if (!endpoint) throw new Error("INSTANCE_PROVIDER_URL_REJECTED");
  const url = new URL(endpoint);
  if (url.search) throw new Error("INSTANCE_PROVIDER_URL_REJECTED");
  return { endpoint: url.toString().replace(/\/$/, ""), token: environment.INSTANCE_PROVIDER_TOKEN };
}

export async function createRemoteChallengeInstance(input: { instanceId: string; idempotencyKey: string; templateRef: string; cpuMilli: number; memoryMb: number; lifetimeMinutes: number }) {
  const { endpoint, token } = provider();
  const response = await fetchPublicNetwork(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey }, body: JSON.stringify(input), redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`INSTANCE_PROVIDER_HTTP_${response.status}`);
  }
  return responseSchema.parse(await readBoundedJsonResponse(response));
}

export async function stopRemoteChallengeInstance(providerReference: string) {
  const { endpoint, token } = provider();
  const response = await fetchPublicNetwork(`${endpoint}/${encodeURIComponent(providerReference)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, redirect: "error", signal: AbortSignal.timeout(15_000) });
  await response.body?.cancel();
  if (!response.ok && response.status !== 404) throw new Error(`INSTANCE_PROVIDER_HTTP_${response.status}`);
}
