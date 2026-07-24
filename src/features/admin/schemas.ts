import { z } from "zod";
import { parseBirthDate } from "@/features/auth/birth-date";

const optionalBirthDate = z.string().transform((value, context) => {
  if (!value) return null;
  const parsed = parseBirthDate(value);
  if (!parsed) {
    context.addIssue({ code: "custom", message: "생년월일을 확인해 주세요." });
    return z.NEVER;
  }
  return parsed;
});

export const adminUserUpdateSchema = z.object({
  userId: z.uuid(),
  name: z.string().trim().min(2).max(50),
  email: z.string().trim().toLowerCase().email().max(320).refine((value) => !value.endsWith("@deleted.invalid")),
  studentNumber: z.string().trim().max(30).regex(/^[0-9A-Za-z-]*$/).transform((value) => value || null),
  birthDate: optionalBirthDate,
  systemRole: z.enum(["USER", "SYSTEM_ADMIN"]),
});

export const adminUserDeleteSchema = z.object({
  userId: z.uuid(),
  confirmationEmail: z.string().trim().toLowerCase().email().max(320),
});

export const adminOrganizationUpdateSchema = z.object({
  organizationId: z.uuid(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).transform((value) => value || null),
});

export const adminOrganizationDeleteSchema = z.object({
  organizationId: z.uuid(),
  confirmationName: z.string().trim().min(2).max(80),
});
