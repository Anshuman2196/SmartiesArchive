import { redirect } from "next/navigation";
import { PasswordUpdateForm } from "@/app/auth/reset/password-form";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return <PasswordUpdateForm/>;
  } catch { /* Show the same safe recovery guidance for missing or expired sessions. */ }
  redirect("/auth?status=callback_error");
}
