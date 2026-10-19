"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chapterSchema, loginSchema, recoverySchema, registrationSchema, workSchema } from "@/lib/validation";
import { friendlyAuthError, safeNextPath } from "@/lib/auth-feedback";

const value = (form: FormData, key: string) => String(form.get(key) ?? "");
const siteOrigin = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
export type AuthActionState = { kind: "idle" | "error" | "success"; message?: string; email?: string; fields?: Record<string, string> };

const fieldErrors = (error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } }) => Object.fromEntries(
  Object.entries(error.flatten().fieldErrors).flatMap(([name, messages]) => messages?.[0] ? [[name, messages[0]]] : []),
);

export async function register(_previous: AuthActionState, form: FormData): Promise<AuthActionState> {
  const parsed = registrationSchema.safeParse({ email: value(form, "email"), password: value(form, "password"), username: value(form, "username"), displayName: value(form, "displayName") });
  if (parsed.success === false) return { kind: "error", message: "Check the highlighted fields and try again.", fields: fieldErrors(parsed.error) };
  if (parsed.data.password !== value(form, "confirmation")) return { kind: "error", message: "The passwords do not match.", fields: { confirmation: "Enter the same password again." } };
  const next = safeNextPath(value(form, "next") || undefined);
  let signupResult;
  try {
    const supabase = await createClient();
    signupResult = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { data: { username: parsed.data.username, display_name: parsed.data.displayName }, emailRedirectTo: `${siteOrigin()}/auth/callback` } });
  } catch (error) { return { kind: "error", message: friendlyAuthError(error, "signup") }; }
  const { data, error } = signupResult;
  if (error) return { kind: "error", message: friendlyAuthError(error, "signup") };
  if (data.session) redirect(next);
  return { kind: "success", message: "Check your email for a confirmation link. Confirm your account to finish signing in.", email: parsed.data.email };
}

export async function signIn(_previous: AuthActionState, form: FormData): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({ email: value(form, "email"), password: value(form, "password") });
  if (!parsed.success) return { kind: "error", message: "Enter a valid email and password.", fields: fieldErrors(parsed.error) };
  let result;
  try {
    const supabase = await createClient();
    result = await supabase.auth.signInWithPassword(parsed.data);
  } catch (error) { return { kind: "error", message: friendlyAuthError(error, "login") }; }
  if (result.error) return { kind: "error", message: friendlyAuthError(result.error, "login") };
  redirect(safeNextPath(value(form, "next") || undefined));
}

export async function resendConfirmation(_previous: AuthActionState, form: FormData): Promise<AuthActionState> {
  const parsed = recoverySchema.safeParse({ email: value(form, "email") });
  if (!parsed.success) return { kind: "error", message: "Enter the email address you registered with.", fields: fieldErrors(parsed.error) };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email: parsed.data.email, options: { emailRedirectTo: `${siteOrigin()}/auth/callback` } });
    if (error) return { kind: "error", message: friendlyAuthError(error, "confirmation") };
  } catch (error) { return { kind: "error", message: friendlyAuthError(error, "confirmation") }; }
  return { kind: "success", message: "If that account still needs confirmation, a fresh link is on its way.", email: parsed.data.email };
}

export async function requestPasswordReset(_previous: AuthActionState, form: FormData): Promise<AuthActionState> {
  const parsed = recoverySchema.safeParse({ email: value(form, "email") });
  if (!parsed.success) return { kind: "error", message: "Enter a valid email address.", fields: fieldErrors(parsed.error) };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${siteOrigin()}/auth/callback?next=%2Fauth%2Freset` });
    if (error) return { kind: "error", message: friendlyAuthError(error, "recovery") };
  } catch (error) { return { kind: "error", message: friendlyAuthError(error, "recovery") }; }
  return { kind: "success", message: "If an account matches that email, a password recovery link is on its way." };
}

export async function updatePassword(_previous: AuthActionState, form: FormData): Promise<AuthActionState> {
  const password = value(form, "password");
  const confirmation = value(form, "confirmation");
  if (password.length < 10 || password.length > 128) return { kind: "error", message: "Choose a password between 10 and 128 characters.", fields: { password: "Use at least 10 characters." } };
  if (password !== confirmation) return { kind: "error", message: "The passwords do not match.", fields: { confirmation: "Enter the same password again." } };
  let error;
  try {
    const supabase = await createClient();
    ({ error } = await supabase.auth.updateUser({ password }));
  } catch (caught) { return { kind: "error", message: friendlyAuthError(caught, "password") }; }
  if (error) return { kind: "error", message: friendlyAuthError(error, "password") };
  return { kind: "success", message: "Your password has been updated." };
}

export async function signOut(_previous: AuthActionState): Promise<AuthActionState> {
  void _previous;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) return { kind: "error", message: "We couldn't sign you out right now. Please try again." };
  } catch { return { kind: "error", message: "We couldn't sign you out right now. Please try again." }; }
  redirect("/");
}

export async function createWork(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const parsed = workSchema.safeParse({ title: value(form, "title"), summary: value(form, "summary"), visibility: value(form, "visibility") });
  if (parsed.success === false) return redirect("/studio?status=invalid_work");
  const { data, error } = await supabase.from("works").insert({ author_id: user.id, ...parsed.data }).select("id").single();
  if (error || !data) redirect("/studio?status=save_error");
  revalidatePath("/studio");
  redirect(`/studio/${data.id}`);
}

export async function createChapter(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const workId = value(form, "workId");
  const parsed = chapterSchema.safeParse({ title: value(form, "title"), content: value(form, "content"), publish: value(form, "publish") });
  if (parsed.success === false) return redirect(`/studio/${workId}?status=invalid_chapter`);
  const { error } = await supabase.from("chapters").insert({ work_id: workId, title: parsed.data.title, body: parsed.data.content, state: parsed.data.publish });
  if (error) redirect(`/studio/${workId}?status=save_error`);
  if (parsed.data.publish === "published") {
    const { error: publishError } = await supabase.from("works").update({ state: "published" }).eq("id", workId).eq("author_id", user.id);
    if (publishError) redirect(`/studio/${workId}?status=save_error`);
  }
  revalidatePath(`/studio/${workId}`);
  revalidatePath("/library");
  redirect(`/studio/${workId}?status=saved`);
}
