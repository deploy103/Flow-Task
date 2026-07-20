"use server";

import { OrganizationIntegrationKind } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { getIntegrationEnvironment } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { encryptIntegrationValue } from "./crypto";
import { validateIntegrationUrl } from "./url-policy";

const createSchema = z.object({ organizationId: z.uuid(), kind: z.enum(Object.values(OrganizationIntegrationKind)), name: z.string().trim().min(1).max(80), endpoint: z.url().max(2048), secret: z.string().max(500).optional() });
const deleteSchema = z.object({ organizationId: z.uuid(), integrationId: z.uuid() });

export async function createOrganizationIntegration(formData: FormData) {
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/dashboard?integration_error=invalid_input`);
  const { organizationId } = parsed.data;
  const { user } = await requireOrganizationAccess(organizationId, true);
  let environment;
  try { environment = getIntegrationEnvironment(); } catch { redirect(`/organizations/${organizationId}/integrations?error=server_configuration`); }
  const endpoint = validateIntegrationUrl(parsed.data.endpoint, parsed.data.kind, environment.allowedHosts);
  if (!endpoint) redirect(`/organizations/${organizationId}/integrations?error=invalid_endpoint`);
  try {
    await prisma.$transaction(async (transaction) => {
      const integration = await transaction.organizationIntegration.create({ data: { organizationId, createdById: user.id, kind: parsed.data.kind, name: parsed.data.name, endpointCiphertext: encryptIntegrationValue(endpoint, environment.INTEGRATION_ENCRYPTION_KEY), secretCiphertext: parsed.data.secret ? encryptIntegrationValue(parsed.data.secret, environment.INTEGRATION_ENCRYPTION_KEY) : null }, select: { id: true } });
      await transaction.auditLog.create({ data: { actorId: user.id, organizationId, action: "ORGANIZATION_INTEGRATION_CREATED", targetType: "ORGANIZATION_INTEGRATION", targetId: integration.id, metadata: { kind: parsed.data.kind, name: parsed.data.name } } });
    });
  } catch { redirect(`/organizations/${organizationId}/integrations?error=create_failed`); }
  redirect(`/organizations/${organizationId}/integrations?success=created`);
}

export async function deleteOrganizationIntegration(formData: FormData) {
  const parsed = deleteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?integration_error=invalid_input");
  const { organizationId, integrationId } = parsed.data;
  const { user } = await requireOrganizationAccess(organizationId, true);
  await prisma.$transaction(async (transaction) => {
    const removed = await transaction.organizationIntegration.deleteMany({ where: { id: integrationId, organizationId } });
    if (!removed.count) throw new Error("NOT_FOUND");
    await transaction.auditLog.create({ data: { actorId: user.id, organizationId, action: "ORGANIZATION_INTEGRATION_DELETED", targetType: "ORGANIZATION_INTEGRATION", targetId: integrationId } });
  });
  redirect(`/organizations/${organizationId}/integrations?success=deleted`);
}
