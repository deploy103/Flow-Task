import { notFound } from "next/navigation";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canReviewSubmissions } from "@/features/organization/permissions";
import { organizationStatisticsExcel } from "@/features/statistics/excel";
import { getOrganizationStatistics } from "@/features/statistics/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const { user, membership } = await requireOrganizationAccess(organizationId);
  if (!canReviewSubmissions({ systemRole: user.systemRole, membership })) notFound();
  const body = organizationStatisticsExcel(await getOrganizationStatistics(organizationId));
  return new Response(body, { headers: { "Cache-Control": "private, no-store", "Content-Disposition": "attachment; filename=flow-task-statistics.xls", "Content-Type": "application/vnd.ms-excel; charset=utf-8", "X-Content-Type-Options": "nosniff" } });
}
