import { NextResponse } from "next/server";
import { hasValidMaintenanceAuthorization } from "@/features/submission/maintenance-auth";
import { runSubmissionUploadJanitor } from "@/features/submission/cleanup";
import { getCleanupEnvironment } from "@/lib/env";

export async function POST(request: Request) {
  let secret: string;
  try {
    secret = getCleanupEnvironment().SUBMISSION_CLEANUP_SECRET;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "CLEANUP_NOT_CONFIGURED", message: "정리 작업이 설정되지 않았습니다." } },
      { status: 503 },
    );
  }
  if (!hasValidMaintenanceAuthorization(request.headers.get("authorization"), secret)) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "권한이 없습니다." } },
      { status: 401 },
    );
  }
  try {
    const result = await runSubmissionUploadJanitor();
    return NextResponse.json(
      { success: true, data: { ...result, completedAt: new Date().toISOString() } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "CLEANUP_FAILED", message: "정리 작업을 완료하지 못했습니다." } },
      { status: 500 },
    );
  }
}
