import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const adminLoginPath = "/auth?mode=login&next=%2Fadmin";

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function isCurrentUserAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(adminLoginPath);

  const { data, error } = await supabase.rpc("is_admin");
  if (error || data !== true) redirect("/");

  return { supabase, user };
}
