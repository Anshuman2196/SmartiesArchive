"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chapterSchema, registrationSchema, workSchema } from "@/lib/validation";

const value = (form: FormData, key: string) => String(form.get(key) ?? "");
const fail = (message: string): never => redirect(`/auth?error=${encodeURIComponent(message)}`);

export async function register(form: FormData) {
  const parsed = registrationSchema.safeParse({ email: value(form, "email"), password: value(form, "password"), username: value(form, "username"), displayName: value(form, "displayName") });
  if (parsed.success === false) return fail("Check your details. Passwords need at least 10 characters; usernames use 3–24 letters, numbers, or underscores.");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { data: { username: parsed.data.username, display_name: parsed.data.displayName }, emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback` } });
  if (error) fail(error.message);
  redirect("/auth?message=Check+your+email+to+confirm+your+account.");
}

export async function signIn(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: value(form, "email"), password: value(form, "password") });
  if (error) fail(error.message);
  redirect("/studio");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function createWork(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const parsed = workSchema.safeParse({ title: value(form, "title"), summary: value(form, "summary"), visibility: value(form, "visibility") });
  if (parsed.success === false) return redirect("/studio?error=Please+check+the+work+details.");
  const { data, error } = await supabase.from("works").insert({ author_id: user.id, ...parsed.data }).select("id").single();
  if (error || !data) redirect(`/studio?error=${encodeURIComponent(error?.message ?? "Could not create work.")}`);
  revalidatePath("/studio");
  redirect(`/studio/${data.id}`);
}

export async function createChapter(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const workId = value(form, "workId");
  const parsed = chapterSchema.safeParse({ title: value(form, "title"), content: value(form, "content"), publish: value(form, "publish") });
  if (parsed.success === false) return redirect(`/studio/${workId}?error=Please+add+a+title+and+chapter+text.`);
  const { error } = await supabase.from("chapters").insert({ work_id: workId, title: parsed.data.title, body: parsed.data.content, state: parsed.data.publish });
  if (error) redirect(`/studio/${workId}?error=${encodeURIComponent(error.message)}`);
  if (parsed.data.publish === "published") {
    const { error: publishError } = await supabase.from("works").update({ state: "published" }).eq("id", workId).eq("author_id", user.id);
    if (publishError) redirect(`/studio/${workId}?error=${encodeURIComponent(publishError.message)}`);
  }
  revalidatePath(`/studio/${workId}`);
  revalidatePath("/library");
  redirect(`/studio/${workId}?message=Chapter+saved.`);
}
