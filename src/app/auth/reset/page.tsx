import { redirect } from "next/navigation";
import { PasswordUpdateForm } from "@/app/auth/reset/password-form";
import { getCurrentUser } from "@/lib/supabase/current-user";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ResetPasswordPage() {
  try {
    const user = await getCurrentUser();
    if (user) return <PasswordUpdateForm/>;
  } catch { /* Show the same safe recovery guidance for missing or expired sessions. */ }
  redirect("/auth?status=callback_error");
}
