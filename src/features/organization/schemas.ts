import { MembershipRole } from "@prisma/client";
import { z } from "zod";

export const organizationSchema = z.object({
  name: z.string().trim().min(2, "조직 이름은 2자 이상이어야 합니다.").max(80),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || undefined),
});

export const invitationSchema = z.object({
  organizationId: z.uuid(),
  role: z.enum([MembershipRole.MEMBER, MembershipRole.MENTOR]),
  expiresInDays: z.coerce.number().int().min(1).max(30),
  maxUses: z.coerce.number().int().min(1).max(500),
});

export const joinOrganizationSchema = z.object({
  invitationCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{12}$/),
});

export const updateMemberRoleSchema = z.object({
  organizationId: z.uuid(),
  memberId: z.uuid(),
  role: z.enum([MembershipRole.MEMBER, MembershipRole.MENTOR, MembershipRole.ORG_ADMIN]),
});

export const organizationSettingsSchema = z.object({
  organizationId: z.uuid(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).transform((value) => value || null),
  removeLogo: z.literal("on").optional().transform(Boolean),
});

export const leaveOrganizationSchema = z.object({
  organizationId: z.uuid(),
  confirmationName: z.string().trim().min(2).max(80),
});
