"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chapterSchema, loginSchema, recoverySchema, registrationSchema, workEditSchema, workSchema } from "@/lib/validation";
import { friendlyAuthError, safeNextPath } from "@/lib/auth-feedback";
import { buildChapterContent } from "@/lib/chapter-content";
import { z } from "zod";

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
  if (!user) redirect("/auth?mode=login&next=%2Fstudio");
  const workId = value(form, "workId");
  if (!z.uuid().safeParse(workId).success) redirect("/studio?status=not_found");
  await requireOwnedWork(workId);
  const parsed = chapterSchema.safeParse({ title: value(form, "title"), content: value(form, "content"), format: value(form, "format") || "prose" });
  if (parsed.success === false) return redirect(`/studio/${workId}?status=invalid_chapter`);
  let payload;
  try { payload = buildChapterContent(parsed.data.format, parsed.data.content, value(form, "mediaAlt")); }
  catch { return redirect(`/studio/${workId}?status=invalid_chapter`); }
  const { error } = await supabase.from("chapters").insert({ work_id: workId, title: parsed.data.title, body: payload.body, format: parsed.data.format, content: payload.content, state: "draft" });
  if (error) redirect(`/studio/${workId}?status=save_error`);
  revalidatePath(`/studio/${workId}`);
  redirect(`/studio/${workId}?status=chapter_created`);
}

async function requireOwnedWork(workId: string) {
  if (!z.uuid().safeParse(workId).success) redirect("/studio?status=save_error");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?mode=login&next=${encodeURIComponent(`/studio/${workId}`)}`);
  const { data: work } = await supabase.from("works").select("id,state,updated_at").eq("id", workId).eq("author_id", user.id).maybeSingle();
  if (!work) redirect("/studio?status=not_found");
  return { supabase, user, work };
}

const csv = (input: string, max: number) => input.split(",").map((item) => item.trim()).filter(Boolean).slice(0, max);
const metadataFrom = (form: FormData) => ({
  title: value(form, "title"), summary: value(form, "summary"), visibility: value(form, "visibility"),
  coverUrl: value(form, "coverUrl"), tags: csv(value(form, "tags"), 21), contentWarnings: csv(value(form, "contentWarnings"), 21),
});

export async function saveWorkMetadata(form: FormData) {
  const workId = value(form, "workId");
  const parsed = workEditSchema.safeParse(metadataFrom(form));
  if (!parsed.success) redirect(`/studio/${workId}?status=invalid_work`);
  if (parsed.data.coverUrl) {
    try { if (new URL(parsed.data.coverUrl).protocol !== "https:") return redirect(`/studio/${workId}?status=invalid_work`); }
    catch { return redirect(`/studio/${workId}?status=invalid_work`); }
  }
  const { supabase, user, work } = await requireOwnedWork(workId);
  const fields = { title: parsed.data.title, summary: parsed.data.summary, visibility: parsed.data.visibility, cover_url: parsed.data.coverUrl, tags: parsed.data.tags, content_warnings: parsed.data.contentWarnings };
  const { data: draft } = await supabase.from("work_drafts").select("updated_at").eq("work_id", workId).maybeSingle();
  if (work.state === "published" || draft) {
    const expected = value(form, "expectedUpdatedAt");
    if ((draft?.updated_at ?? work.updated_at) !== expected) redirect(`/studio/${workId}?status=conflict`);
    const result = draft
      ? await supabase.from("work_drafts").update({ ...fields, updated_at: new Date().toISOString() }).eq("work_id", workId).eq("updated_at", expected).select("work_id").maybeSingle()
      : await supabase.from("work_drafts").insert({ work_id: workId, ...fields }).select("work_id").maybeSingle();
    if (result.error || !result.data) redirect(`/studio/${workId}?status=conflict`);
    revalidatePath(`/studio/${workId}`);
    revalidatePath(`/work/${workId}`);
    redirect(`/studio/${workId}?status=metadata_draft`);
  }
  const { data, error } = await supabase.from("works").update(fields).eq("id", workId).eq("author_id", user.id).eq("updated_at", value(form, "expectedUpdatedAt")).select("id").maybeSingle();
  if (error || !data) redirect(`/studio/${workId}?status=conflict`);
  await supabase.from("work_drafts").delete().eq("work_id", workId);
  revalidatePath(`/studio/${workId}`);
  revalidatePath(`/work/${workId}`);
  revalidatePath("/library");
  redirect(`/studio/${workId}?status=metadata_saved`);
}

export async function publishWork(form: FormData) {
  const workId = value(form, "workId");
  const { supabase } = await requireOwnedWork(workId);
  const { data, error } = await supabase.rpc("publish_work", { p_work_id: workId });
  if (error) redirect(`/studio/${workId}?status=save_error`);
  if (!data) redirect(`/studio/${workId}?status=no_published_chapters`);
  revalidatePath(`/studio/${workId}`);
  revalidatePath(`/work/${workId}`);
  revalidatePath("/library");
  redirect(`/studio/${workId}?status=published`);
}

export async function unpublishWork(form: FormData) {
  const workId = value(form, "workId");
  const { supabase, user } = await requireOwnedWork(workId);
  const { data, error } = await supabase.from("works").update({ state: "draft" }).eq("id", workId).eq("author_id", user.id).select("id").maybeSingle();
  if (error || !data) redirect(`/studio/${workId}?status=save_error`);
  revalidatePath(`/studio/${workId}`); revalidatePath(`/work/${workId}`); revalidatePath("/library");
  redirect(`/studio/${workId}?status=unpublished`);
}

export async function deleteWork(form: FormData) {
  const workId = value(form, "workId");
  const { supabase, user } = await requireOwnedWork(workId);
  const { data, error } = await supabase.from("works").delete().eq("id", workId).eq("author_id", user.id).select("id").maybeSingle();
  if (error || !data) redirect(`/studio/${workId}?status=save_error`);
  revalidatePath("/studio"); revalidatePath("/library");
  redirect("/studio?status=work_deleted");
}

const chapterIdSchema = z.uuid();
const saveChapterSchema = chapterSchema.extend({ workId: z.uuid(), chapterId: z.uuid(), expectedUpdatedAt: z.string().refine((value) => Number.isFinite(Date.parse(value))) });

export async function saveChapter(form: FormData) {
  const workId = value(form, "workId");
  const chapterId = value(form, "chapterId");
  const parsed = saveChapterSchema.safeParse({ workId, chapterId, title: value(form, "title"), content: value(form, "content"), format: value(form, "format") || "prose", expectedUpdatedAt: value(form, "expectedUpdatedAt") });
  if (!parsed.success) redirect(`/studio/${workId}?chapter=${chapterId}&status=invalid_chapter`);
  let payload;
  try { payload = buildChapterContent(parsed.data.format, parsed.data.content, value(form, "mediaAlt")); }
  catch { redirect(`/studio/${workId}?chapter=${chapterId}&status=invalid_chapter`); }
  const { supabase } = await requireOwnedWork(workId);
  const { data: chapter } = await supabase.from("chapters").select("id,state,updated_at").eq("id", chapterId).eq("work_id", workId).maybeSingle();
  if (!chapter) redirect(`/studio/${workId}?status=not_found`);
  const { data: draft } = await supabase.from("chapter_drafts").select("updated_at").eq("work_id", workId).eq("chapter_id", chapterId).maybeSingle();
  const isStaged = chapter.state === "published" || !!draft;
  const expected = isStaged ? draft?.updated_at ?? chapter.updated_at : chapter.updated_at;
  if (expected !== parsed.data.expectedUpdatedAt) redirect(`/studio/${workId}?chapter=${chapterId}&status=conflict`);
  const contentFields = { title: parsed.data.title, body: payload.body, format: parsed.data.format, content: payload.content };
  if (isStaged) {
    const result = draft
      ? await supabase.from("chapter_drafts").update({ ...contentFields, updated_at: new Date().toISOString() }).eq("work_id", workId).eq("chapter_id", chapterId).eq("updated_at", expected).select("chapter_id").maybeSingle()
      : await supabase.from("chapter_drafts").insert({ work_id: workId, chapter_id: chapterId, ...contentFields }).select("chapter_id").maybeSingle();
    if (result.error || !result.data) redirect(`/studio/${workId}?chapter=${chapterId}&status=conflict`);
  } else {
    const { data, error } = await supabase.from("chapters").update(contentFields).eq("id", chapterId).eq("work_id", workId).eq("state", "draft").eq("updated_at", expected).select("id").maybeSingle();
    if (error || !data) redirect(`/studio/${workId}?chapter=${chapterId}&status=conflict`);
  }
  revalidatePath(`/studio/${workId}`); revalidatePath(`/work/${workId}`); revalidatePath(`/work/${workId}/chapter/${chapterId}`);
  redirect(`/studio/${workId}?chapter=${chapterId}&status=${isStaged ? "chapter_draft_saved" : "chapter_saved"}`);
}

export async function publishChapter(form: FormData) {
  const workId = value(form, "workId"), chapterId = value(form, "chapterId");
  if (!chapterIdSchema.safeParse(chapterId).success) redirect(`/studio/${workId}?status=not_found`);
  const { supabase } = await requireOwnedWork(workId);
  const { data, error } = await supabase.rpc("publish_chapter", { p_work_id: workId, p_chapter_id: chapterId });
  if (error || !data) redirect(`/studio/${workId}?status=save_error`);
  revalidatePath(`/studio/${workId}`); revalidatePath(`/work/${workId}`); revalidatePath(`/work/${workId}/chapter/${chapterId}`); revalidatePath("/library");
  redirect(`/studio/${workId}?status=chapter_published`);
}

export async function unpublishChapter(form: FormData) {
  const workId = value(form, "workId"), chapterId = value(form, "chapterId");
  if (!chapterIdSchema.safeParse(chapterId).success) redirect(`/studio/${workId}?status=not_found`);
  const { supabase } = await requireOwnedWork(workId);
  const { data, error } = await supabase.from("chapters").update({ state: "draft" }).eq("id", chapterId).eq("work_id", workId).eq("state", "published").select("id").maybeSingle();
  if (error || !data) redirect(`/studio/${workId}?status=save_error`);
  revalidatePath(`/studio/${workId}`); revalidatePath(`/work/${workId}`); revalidatePath("/library");
  redirect(`/studio/${workId}?status=chapter_unpublished`);
}

export async function deleteChapter(form: FormData) {
  const workId = value(form, "workId"), chapterId = value(form, "chapterId");
  if (!chapterIdSchema.safeParse(chapterId).success) redirect(`/studio/${workId}?status=not_found`);
  const { supabase } = await requireOwnedWork(workId);
  const { data, error } = await supabase.from("chapters").delete().eq("id", chapterId).eq("work_id", workId).select("id").maybeSingle();
  if (error || !data) redirect(`/studio/${workId}?status=save_error`);
  revalidatePath(`/studio/${workId}`); revalidatePath(`/work/${workId}`); revalidatePath("/library");
  redirect(`/studio/${workId}?status=chapter_deleted`);
}

export async function duplicateChapter(form: FormData) {
  const workId = value(form, "workId"), chapterId = value(form, "chapterId");
  if (!chapterIdSchema.safeParse(chapterId).success) redirect(`/studio/${workId}?status=not_found`);
  const { supabase } = await requireOwnedWork(workId);
  const { data: source } = await supabase.from("chapters").select("id,title,body,format,content").eq("id", chapterId).eq("work_id", workId).maybeSingle();
  if (!source) redirect(`/studio/${workId}?status=not_found`);
  const { data: draft } = await supabase.from("chapter_drafts").select("title,body,format,content").eq("work_id", workId).eq("chapter_id", chapterId).maybeSingle();
  const selected = draft ?? source;
  const { error } = await supabase.from("chapters").insert({ work_id: workId, title: `${selected.title.slice(0, 113)} (copy)`, body: selected.body, format: selected.format, content: selected.content, state: "draft" });
  if (error) redirect(`/studio/${workId}?status=save_error`);
  revalidatePath(`/studio/${workId}`);
  redirect(`/studio/${workId}?status=chapter_duplicated`);
}

export async function reorderChapter(form: FormData) {
  const workId = value(form, "workId"), chapterId = value(form, "chapterId"), direction = value(form, "direction");
  if (!chapterIdSchema.safeParse(chapterId).success || !["up", "down"].includes(direction)) redirect(`/studio/${workId}?status=invalid_chapter`);
  const { supabase } = await requireOwnedWork(workId);
  const { data: chapters, error } = await supabase.from("chapters").select("id").eq("work_id", workId).order("position");
  if (error || !chapters) redirect(`/studio/${workId}?status=save_error`);
  const ids = chapters.map((chapter) => chapter.id), index = ids.indexOf(chapterId), adjacent = direction === "up" ? index - 1 : index + 1;
  if (index < 0) redirect(`/studio/${workId}?status=not_found`);
  if (adjacent < 0 || adjacent >= ids.length) redirect(`/studio/${workId}?status=reordered`);
  [ids[index], ids[adjacent]] = [ids[adjacent], ids[index]];
  const { data, error: reorderError } = await supabase.rpc("reorder_chapters", { p_work_id: workId, p_chapter_ids: ids });
  if (reorderError || !data) redirect(`/studio/${workId}?status=conflict`);
  revalidatePath(`/studio/${workId}`); revalidatePath(`/work/${workId}`);
  redirect(`/studio/${workId}?status=reordered`);
}

export async function toggleBookmark(workId: string, saved: boolean): Promise<{ ok: boolean; saved: boolean; message: string }> {
  if (!z.uuid().safeParse(workId).success) return { ok: false, saved: false, message: "That story could not be found." };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, saved: false, message: "Sign in to save stories to your bookmarks." };
    const result = saved
      ? await supabase.from("user_bookmarks").insert({ user_id: user.id, work_id: workId })
      : await supabase.from("user_bookmarks").delete().eq("user_id", user.id).eq("work_id", workId);
    if (result.error) return { ok: false, saved: !saved, message: "We couldn't update your bookmark. Please try again." };
    revalidatePath(`/work/${workId}`);
    return { ok: true, saved, message: "" };
  } catch { return { ok: false, saved: !saved, message: "We couldn't update your bookmark. Please try again." }; }
}

export async function saveReadingProgress(workId: string, chapterId: string, progress: number): Promise<boolean> {
  if (!z.uuid().safeParse(workId).success || !z.uuid().safeParse(chapterId).success || !Number.isFinite(progress) || progress < 0 || progress > 1) return false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from("reading_progress").upsert({ user_id: user.id, work_id: workId, chapter_id: chapterId, progress }, { onConflict: "user_id,work_id" });
    return !error;
  } catch { return false; }
}
