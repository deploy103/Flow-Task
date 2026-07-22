"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { getIntegrationEnvironment } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { encryptIntegrationValue } from "./crypto";
import { parseIntegrationKind } from "./catalog";
import { createIntegrationSchema, deleteIntegrationSchema, integrationOrganizationSchema } from "./schemas";
import { validateIntegrationUrl } from "./url-policy";

function integrationPage(organizationId: string, parameters: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(parameters)) if (value) search.set(key, value);
  return `/organizations/${organizationId}/integrations?${search.toString()}`;
}

export async function createOrganizationIntegration(formData: FormData) {
  const organizationIdResult = integrationOrganizationSchema.safeParse(formData.get("organizationId"));
  if (!organizationIdResult.success) redirect("/dashboard?integration_error=invalid_input");
  const submittedKind = parseIntegrationKind(String(formData.get("kind") ?? ""));
  const parsed = createIntegrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(integrationPage(organizationIdResult.data, { error: "invalid_input", kind: submittedKind ?? undefined }));
  const { organizationId } = parsed.data;
  const { user } = await requireOrganizationAccess(organizationId, true);
  let environment;
  try { environment = getIntegrationEnvironment(); } catch { redirect(integrationPage(organizationId, { error: "server_configuration", kind: parsed.data.kind })); }
  const endpoint = validateIntegrationUrl(parsed.data.endpoint, parsed.data.kind, environment.allowedHosts);
  if (!endpoint) redirect(integrationPage(organizationId, { error: "invalid_endpoint", kind: parsed.data.kind }));
  try {
    await prisma.$transaction(async (transaction) => {
      const integration = await transaction.organizationIntegration.create({ data: { organizationId, createdById: user.id, kind: parsed.data.kind, name: parsed.data.name, endpointCiphertext: encryptIntegrationValue(endpoint, environment.INTEGRATION_ENCRYPTION_KEY), secretCiphertext: parsed.data.secret ? encryptIntegrationValue(parsed.data.secret, environment.INTEGRATION_ENCRYPTION_KEY) : null }, select: { id: true } });
      await transaction.auditLog.create({ data: { actorId: user.id, organizationId, action: "ORGANIZATION_INTEGRATION_CREATED", targetType: "ORGANIZATION_INTEGRATION", targetId: integration.id, metadata: { kind: parsed.data.kind, name: parsed.data.name } } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") redirect(integrationPage(organizationId, { error: "duplicate", kind: parsed.data.kind }));
    redirect(integrationPage(organizationId, { error: "create_failed", kind: parsed.data.kind }));
  }
  redirect(`/organizations/${organizationId}/integrations?success=created`);
}

export async function deleteOrganizationIntegration(formData: FormData) {
  const parsed = deleteIntegrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?integration_error=invalid_input");
  const { organizationId, integrationId } = parsed.data;
  const { user } = await requireOrganizationAccess(organizationId, true);
  try {
    await prisma.$transaction(async (transaction) => {
      const removed = await transaction.organizationIntegration.deleteMany({ where: { id: integrationId, organizationId } });
      if (!removed.count) throw new Error("NOT_FOUND");
      await transaction.auditLog.create({ data: { actorId: user.id, organizationId, action: "ORGANIZATION_INTEGRATION_DELETED", targetType: "ORGANIZATION_INTEGRATION", targetId: integrationId } });
    });
  } catch { redirect(`/organizations/${organizationId}/integrations?error=delete_failed`); }
  redirect(`/organizations/${organizationId}/integrations?success=deleted`);
}
