import { z } from "zod";

export const ADMIN_AUDIT_PAGE_SIZE = 50;

const optionalText = (maximum: number) => z.string().trim().max(maximum).optional().transform((value) => value || undefined);

export const adminAuditQuerySchema = z.object({
  q: optionalText(100),
  action: optionalText(80),
  targetType: optionalText(50),
  organizationId: z.union([z.literal(""), z.uuid()]).optional().transform((value) => value || undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type AdminAuditQuery = z.infer<typeof adminAuditQuerySchema>;

export function parseAdminAuditQuery(input: Record<string, string | string[] | undefined>): AdminAuditQuery {
  const scalarInput = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const parsed = adminAuditQuerySchema.safeParse(scalarInput);
  return parsed.success
    ? parsed.data
    : { q: undefined, action: undefined, targetType: undefined, organizationId: undefined, page: 1 };
}
