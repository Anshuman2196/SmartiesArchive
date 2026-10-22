import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { authStatusMessage, safeNextPath } from "@/lib/auth-feedback";
import { getCurrentUser } from "@/lib/supabase/current-user";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your account" };

type AuthMode = "login" | "signup" | "recover";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ mode?: string; next?: string; status?: string | string[]; error?: string; message?: string }> }) {
  const params = await searchParams;
  const mode: AuthMode = params.mode === "signup" || params.mode === "recover" ? params.mode : "login";
  const next = safeNextPath(params.next);
  const statusMessage = authStatusMessage(params.status);
  if (mode !== "recover") {
    let authenticated = false;
    try {
      const user = await getCurrentUser();
      authenticated = !!user;
    } catch { /* Render the signed-out form if Supabase is unavailable. */ }
    if (authenticated && !statusMessage) redirect(next);
  }
  return <AuthForm mode={mode} statusMessage={statusMessage} next={next}/>;
}
