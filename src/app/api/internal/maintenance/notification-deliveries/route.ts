import { NextResponse } from "next/server";
import { processNotificationDeliveries } from "@/features/notification/delivery";
import { hasValidMaintenanceAuthorization } from "@/features/submission/maintenance-auth";
import { getNotificationDeliveryEnvironment } from "@/lib/env";

export async function POST(request: Request) {
  let secret: string;
  try { secret = getNotificationDeliveryEnvironment().NOTIFICATION_DELIVERY_SECRET; } catch { return NextResponse.json({ success: false, error: "not_configured" }, { status: 503 }); }
  if (!hasValidMaintenanceAuthorization(request.headers.get("authorization"), secret)) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  try { return NextResponse.json({ success: true, data: await processNotificationDeliveries() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ success: false, error: "delivery_failed" }, { status: 500 }); }
}
