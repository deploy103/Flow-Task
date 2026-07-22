import { notFound } from "next/navigation";
import { z } from "zod";
import { downloadOrganizationLogo } from "@/features/organization/logo-storage";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const id = z.uuid().safeParse((await params).organizationId);
  if (!id.success) notFound();
  await requireOrganizationAccess(id.data);
  const organization = await prisma.organization.findFirst({ where: { id: id.data, archivedAt: null }, select: { logoStoragePath: true, logoMimeType: true } });
  if (!organization?.logoStoragePath || !organization.logoMimeType) notFound();
  try {
    const logo = await downloadOrganizationLogo(organization.logoStoragePath);
    return new Response(logo, { headers: { "Cache-Control": "private, no-store", "Content-Type": organization.logoMimeType, "Content-Length": String(logo.byteLength), "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
  } catch {
    return new Response("로고를 불러올 수 없습니다.", { status: 502 });
  }
}
