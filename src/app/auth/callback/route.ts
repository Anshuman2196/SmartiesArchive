import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth-feedback";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/auth?status=callback_error", request.url));
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  } catch {
    // Do not reflect provider errors, callback parameters, or the one-time code into the UI.
  }
  return NextResponse.redirect(new URL("/auth?status=callback_error", request.url));
}
