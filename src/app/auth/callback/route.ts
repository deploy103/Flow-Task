import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/features/auth/profile-recovery";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=invalid_callback", requestUrl.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=invalid_callback", requestUrl.origin));
  }

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) {
    return NextResponse.redirect(new URL("/login?error=invalid_callback", requestUrl.origin));
  }
  try {
    await ensureUserProfile(data.user);
  } catch {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=profile_recovery_failed", requestUrl.origin));
  }

  return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
}
