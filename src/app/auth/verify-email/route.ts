import { NextResponse, type NextRequest } from "next/server";
import { consumeEmailVerificationToken } from "@/features/auth/email-verification";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get("token") ?? "";
  try {
    if (await consumeEmailVerificationToken(token)) {
      return NextResponse.redirect(new URL("/login?message=email_verified", requestUrl.origin));
    }
  } catch {
    // DB 오류도 토큰 유효성 정보와 구분하지 않는다.
  }
  return NextResponse.redirect(new URL("/verify-email?error=invalid_or_expired_verification", requestUrl.origin));
}
