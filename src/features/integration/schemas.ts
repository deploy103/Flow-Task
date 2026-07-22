import { OrganizationIntegrationKind } from "@prisma/client";
import { z } from "zod";
import {
  MAX_INTEGRATION_ENDPOINT_LENGTH,
  MAX_INTEGRATION_NAME_LENGTH,
  MAX_INTEGRATION_SECRET_LENGTH,
  MIN_INTEGRATION_NAME_LENGTH,
} from "@/constants/integration";

export const integrationOrganizationSchema = z.uuid();

export const createIntegrationSchema = z.object({
  organizationId: integrationOrganizationSchema,
  kind: z.enum(Object.values(OrganizationIntegrationKind)),
  name: z.string().trim().min(MIN_INTEGRATION_NAME_LENGTH).max(MAX_INTEGRATION_NAME_LENGTH),
  endpoint: z.url().max(MAX_INTEGRATION_ENDPOINT_LENGTH),
  secret: z.string().max(MAX_INTEGRATION_SECRET_LENGTH).optional(),
});

export const deleteIntegrationSchema = z.object({
  organizationId: integrationOrganizationSchema,
  integrationId: z.uuid(),
});
