import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL("/studio", request.url));
    } catch { /* Use the same non-sensitive error for invalid, expired, or unavailable confirmations. */ }
  }
  return NextResponse.redirect(new URL("/auth?error=This+confirmation+link+is+invalid+or+expired.", request.url));
}
