"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chapterSchema, loginSchema, recoverySchema, registrationSchema, workEditSchema, workSchema } from "@/lib/validation";
import { friendlyAuthError, safeNextPath } from "@/lib/auth-feedback";
import { buildChapterContent } from "@/lib/chapter-content";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { RichDocumentValidationError, safeRichDocumentErrorMessage, validateRichDocument } from "@/lib/rich-document";
import { storyMediaExtension, validStoryImageHeader, validStoryPdfHeader } from "@/lib/image-validation";

const value = (form: FormData, key: string) => String(form.get(key) ?? "");
const siteOrigin = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
export type AuthActionState = { kind: "idle" | "error" | "success"; message?: string; email?: string; fields?: Record<string, string> };

const fieldErrors = (error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } }) => Object.fromEntries(
  Object.entries(error.flatten().fieldErrors).flatMap(([name, messages]) => messages?.[0] ? [[name, messages[0]]] : []),
);

import { chapterReviewSchema, type ReviewActionState } from "@/lib/chapter-reviews";

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

export async function createWorkRecord(form: FormData): Promise<{ ok: boolean; workId?: string; message?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in before creating a story." };
  const parsed = workSchema.safeParse({ title: value(form, "title"), summary: value(form, "summary"), visibility: value(form, "visibility") });
  if (parsed.success === false) return { ok: false, message: "Add a title and check the work details before saving." };
  const { data, error } = await supabase.from("works").insert({ author_id: user.id, ...parsed.data }).select("id").single();
  if (error || !data) return { ok: false, message: "The story could not be created. Try again." };
  revalidatePath("/studio");
  return { ok: true, workId: data.id };
}

export async function setWorkCover(workId: string, coverUrl: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const { supabase, user } = await requireOwnedWorkForAction(workId);
    const allowed = coverUrl === "" || new RegExp(`^storage://story-media/${user.id}/${workId}/[a-f0-9-]{36}\\.(?:png|jpe?g|webp|gif)$`, "i").test(coverUrl);
    if (!allowed) return { ok: false, message: "The cover reference could not be verified." };
    const { error } = await supabase.from("works").update({ cover_url: coverUrl }).eq("id", workId).eq("author_id", user.id);
    if (error) return { ok: false, message: "The cover could not be saved." };
    await cleanupUnreferencedStoryMedia(supabase, user.id, workId);
    revalidatePath(`/studio/${workId}`); revalidatePath(`/work/${workId}`); revalidatePath("/studio");
    return { ok: true };
  } catch { return { ok: false, message: "The cover could not be saved." }; }
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
  const { supabase, user, work } = await requireOwnedWork(workId);
  if (parsed.data.coverUrl) {
    const uploadedPath = new RegExp(`^storage://story-media/${user.id}/${workId}/[a-f0-9-]{36}\\.(?:png|jpe?g|webp|gif)$`, "i").test(parsed.data.coverUrl);
    let secureUrl = false;
    try { secureUrl = new URL(parsed.data.coverUrl).protocol === "https:"; } catch { /* Storage references are checked separately. */ }
    if (!uploadedPath && !secureUrl) redirect(`/studio/${workId}?status=invalid_work`);
  }
  const fields = { title: parsed.data.title, summary: parsed.data.summary, visibility: parsed.data.visibility, cover_url: parsed.data.coverUrl, tags: parsed.data.tags, content_warnings: parsed.data.contentWarnings };
  const { data: draft } = await supabase.from("work_drafts").select("updated_at").eq("work_id", workId).maybeSingle();
  if (work.state === "published" || draft) {
    const expected = value(form, "expectedUpdatedAt");
    if ((draft?.updated_at ?? work.updated_at) !== expected) redirect(`/studio/${workId}?status=conflict`);
    const result = draft
      ? await supabase.from("work_drafts").update({ ...fields, updated_at: new Date().toISOString() }).eq("work_id", workId).eq("updated_at", expected).select("work_id").maybeSingle()
      : await supabase.from("work_drafts").insert({ work_id: workId, ...fields }).select("work_id").maybeSingle();
    if (result.error || !result.data) redirect(`/studio/${workId}?status=conflict`);
    await cleanupUnreferencedStoryMedia(supabase, user.id, workId);
    revalidatePath(`/studio/${workId}`);
    revalidatePath(`/work/${workId}`);
    redirect(`/studio/${workId}?status=metadata_draft`);
  }
  const { data, error } = await supabase.from("works").update(fields).eq("id", workId).eq("author_id", user.id).eq("updated_at", value(form, "expectedUpdatedAt")).select("id").maybeSingle();
  if (error || !data) redirect(`/studio/${workId}?status=conflict`);
  await supabase.from("work_drafts").delete().eq("work_id", workId);
  await cleanupUnreferencedStoryMedia(supabase, user.id, workId);
  revalidatePath(`/studio/${workId}`);
  revalidatePath(`/work/${workId}`);
  revalidatePath("/library");
  redirect(`/studio/${workId}?status=metadata_saved`);
}

export async function publishWork(form: FormData) {
  const workId = value(form, "workId");
  const { supabase, user } = await requireOwnedWork(workId);
  const { data, error } = await supabase.rpc("publish_work", { p_work_id: workId });
  if (error) redirect(`/studio/${workId}?status=save_error`);
  if (!data) redirect(`/studio/${workId}?status=no_published_chapters`);
  await cleanupUnreferencedStoryMedia(supabase, user.id, workId);
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
  const draftOnly = value(form, "draftOnly") === "1";
  const { supabase, user } = await requireOwnedWork(workId);
  const deletion = supabase.from("works").delete().eq("id", workId).eq("author_id", user.id);
  const { data, error } = await (draftOnly ? deletion.eq("state", "draft") : deletion).select("id").maybeSingle();
  if (error) {
    // Keep diagnostics useful while excluding database messages and content.
    console.warn("[studio-delete] work delete rejected", { code: error.code ?? "unknown" });
    redirect(draftOnly ? "/studio?status=delete_failed" : `/studio/${workId}?status=delete_failed`);
  }
  if (!data) redirect(draftOnly ? "/studio?status=delete_not_found" : `/studio/${workId}?status=delete_not_found`);
  await removeAllStoryMedia(supabase, user.id, workId);
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
  const { supabase, user } = await requireOwnedWork(workId);
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
  await cleanupUnreferencedStoryMedia(supabase, user.id, workId);
  revalidatePath(`/studio/${workId}`); revalidatePath(`/work/${workId}`); revalidatePath(`/work/${workId}/chapter/${chapterId}`);
  redirect(`/studio/${workId}?chapter=${chapterId}&status=${isStaged ? "chapter_draft_saved" : "chapter_saved"}`);
}

export async function publishChapter(form: FormData) {
  const workId = value(form, "workId"), chapterId = value(form, "chapterId");
  if (!chapterIdSchema.safeParse(chapterId).success) redirect(`/studio/${workId}?status=not_found`);
  const { supabase, user } = await requireOwnedWork(workId);
  const [{ data: chapter }, { data: draft }] = await Promise.all([
    supabase.from("chapters").select("format,content,body").eq("id", chapterId).eq("work_id", workId).maybeSingle(),
    supabase.from("chapter_drafts").select("format,content,body").eq("chapter_id", chapterId).eq("work_id", workId).maybeSingle(),
  ]);
  const publication = draft ?? chapter;
  if (!chapter || !publication) redirect(`/studio/${workId}?status=not_found`);
  if (publication.format === "prose" && typeof publication.content === "object" && publication.content !== null && (publication.content as { type?: string }).type === "rich") {
    try { validateRichDocument((publication.content as { document?: unknown }).document, user.id, workId); }
    catch (error) {
      if (error instanceof RichDocumentValidationError) console.warn("[rich-document-validation]", error.diagnostic);
      redirect(`/studio/${workId}?chapter=${chapterId}&status=invalid_chapter_format`);
    }
  }
  const { data, error } = await supabase.rpc("publish_chapter", { p_work_id: workId, p_chapter_id: chapterId });
  if (error || !data) redirect(`/studio/${workId}?status=save_error`);
  await cleanupUnreferencedStoryMedia(supabase, user.id, workId);
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
  const { supabase, user } = await requireOwnedWork(workId);
  const { data, error } = await supabase.from("chapters").delete().eq("id", chapterId).eq("work_id", workId).select("id").maybeSingle();
  if (error) {
    console.warn("[studio-delete] chapter delete rejected", { code: error.code ?? "unknown" });
    redirect(`/studio/${workId}?status=delete_failed`);
  }
  if (!data) redirect(`/studio/${workId}?status=delete_not_found`);
  await cleanupUnreferencedStoryMedia(supabase, user.id, workId);
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
    revalidatePath("/shelf");
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
    if (!error) revalidatePath("/shelf");
    return !error;
  } catch { return false; }
}

const storyMediaBucket = "story-media";
const storyMediaObjectPattern = /^[0-9a-f-]{36}\.(?:png|jpe?g|webp|gif|pdf)$/i;

function storyMediaObjectName(reference: unknown, userId: string, workId: string): string | undefined {
  if (typeof reference !== "string") return undefined;
  const match = reference.match(/^storage:\/\/story-media\/([^/]+)\/([^/]+)\/([^/]+)$/i);
  if (!match || match[1].toLowerCase() !== userId.toLowerCase() || match[2].toLowerCase() !== workId.toLowerCase() || !storyMediaObjectPattern.test(match[3])) return undefined;
  return `${userId}/${workId}/${match[3]}`;
}

function collectStoryMediaReferences(value: unknown, userId: string, workId: string, references: Set<string>) {
  const objectName = storyMediaObjectName(value, userId, workId);
  if (objectName) references.add(objectName);
  if (Array.isArray(value)) {
    value.forEach((item) => collectStoryMediaReferences(item, userId, workId, references));
  } else if (typeof value === "object" && value !== null) {
    Object.values(value as Record<string, unknown>).forEach((item) => collectStoryMediaReferences(item, userId, workId, references));
  }
}

async function removeStoryMediaObjects(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, workId: string, keep = new Set<string>()) {
  const folder = `${userId}/${workId}`;
  const { data, error } = await supabase.storage.from(storyMediaBucket).list(folder, { limit: 1000 });
  if (error) {
    console.warn("[story-media-cleanup] list rejected", { message: error.message });
    return;
  }
  const removable = (data ?? [])
    .filter((item) => storyMediaObjectPattern.test(item.name))
    .map((item) => `${folder}/${item.name}`)
    .filter((objectName) => !keep.has(objectName));
  if (!removable.length) return;
  const { error: removeError } = await supabase.storage.from(storyMediaBucket).remove(removable);
  if (removeError) console.warn("[story-media-cleanup] remove rejected", { message: removeError.message });
}

async function removeAllStoryMedia(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, workId: string) {
  await removeStoryMediaObjects(supabase, userId, workId);
}

async function cleanupUnreferencedStoryMedia(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, workId: string) {
  const [workResult, workDraftResult, chaptersResult, chapterDraftsResult] = await Promise.all([
    supabase.from("works").select("cover_url").eq("id", workId).eq("author_id", userId).maybeSingle(),
    supabase.from("work_drafts").select("cover_url").eq("work_id", workId).maybeSingle(),
    supabase.from("chapters").select("content").eq("work_id", workId),
    supabase.from("chapter_drafts").select("content").eq("work_id", workId),
  ]);
  if (workResult.error || workDraftResult.error || chaptersResult.error || chapterDraftsResult.error) {
    console.warn("[story-media-cleanup] reference scan rejected", { message: workResult.error?.message ?? workDraftResult.error?.message ?? chaptersResult.error?.message ?? chapterDraftsResult.error?.message ?? "unknown" });
    return;
  }
  const references = new Set<string>();
  collectStoryMediaReferences(workResult.data?.cover_url, userId, workId, references);
  collectStoryMediaReferences(workDraftResult.data?.cover_url, userId, workId, references);
  for (const chapter of chaptersResult.data ?? []) collectStoryMediaReferences(chapter.content, userId, workId, references);
  for (const draft of chapterDraftsResult.data ?? []) collectStoryMediaReferences(draft.content, userId, workId, references);
  await removeStoryMediaObjects(supabase, userId, workId, references);
}

async function requireOwnedWorkForAction(workId: string) {
  if (!z.uuid().safeParse(workId).success) throw new Error("This story could not be found.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to edit this story.");
  const { data } = await supabase.from("works").select("id").eq("id", workId).eq("author_id", user.id).maybeSingle();
  if (!data) throw new Error("This story is no longer available.");
  return { supabase, user };
}

export async function prepareStoryMediaUpload(workId: string, fileName: string, mimeType: string, fileSize: number, headerBytes: number[]): Promise<{ ok: boolean; path?: string; token?: string; message?: string }> {
  try {
    const { supabase, user } = await requireOwnedWorkForAction(workId);
    const isImage = mimeType.startsWith("image/");
    const valid = Array.isArray(headerBytes) && (isImage ? validStoryImageHeader(mimeType, fileSize, headerBytes) : validStoryPdfHeader(mimeType, fileSize, headerBytes));
    if (!valid) return { ok: false, message: isImage ? "Choose a valid JPEG, PNG, WebP, or GIF image under 8 MB." : "Choose a valid PDF under 50 MB." };
    void fileName;
    const extension = storyMediaExtension(mimeType);
    if (!extension) return { ok: false, message: "That file type is not supported." };
    const path = `${user.id}/${workId}/${randomUUID()}.${extension}`;
    const { data, error } = await supabase.storage.from(storyMediaBucket).createSignedUploadUrl(path, { upsert: false });
    if (error || !data?.token) return { ok: false, message: "The secure upload could not be prepared." };
    return { ok: true, path, token: data.token };
  } catch { return { ok: false, message: "Sign in and try uploading this image again." }; }
}

export async function finishStoryMediaUpload(workId: string, path: string): Promise<{ ok: boolean; src?: string; previewSrc?: string; message?: string }> {
  try {
    const { supabase, user } = await requireOwnedWorkForAction(workId);
    const expectedPrefix = `${user.id}/${workId}/`;
    if (!path.startsWith(expectedPrefix) || !new RegExp(`^${user.id}/${workId}/[a-f0-9-]{36}\\.(?:png|jpe?g|webp|gif|pdf)$`, "i").test(path)) return { ok: false, message: "The uploaded media could not be verified." };
    const { data, error } = await supabase.storage.from(storyMediaBucket).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return { ok: false, message: "The media uploaded, but its preview could not be prepared." };
    return { ok: true, src: `storage://${storyMediaBucket}/${path}`, previewSrc: data.signedUrl };
  } catch { return { ok: false, message: "The image could not be verified." }; }
}

export async function listWorkMedia(workId: string): Promise<Array<{ src: string; previewSrc: string; name: string }>> {
  const { supabase, user } = await requireOwnedWork(workId);
  const folder = `${user.id}/${workId}`;
  const { data } = await supabase.storage.from(storyMediaBucket).list(folder, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  const items = await Promise.all((data ?? []).filter((item) => /\.(png|jpe?g|webp|gif)$/i.test(item.name)).map(async (item) => {
    const src = `storage://${storyMediaBucket}/${folder}/${item.name}`;
    const { data: signed } = await supabase.storage.from(storyMediaBucket).createSignedUrl(`${folder}/${item.name}`, 3600);
    return signed?.signedUrl ? { src, previewSrc: signed.signedUrl, name: item.name } : null;
  }));
  return items.filter((item): item is NonNullable<typeof item> => !!item);
}

export async function saveRichChapter(workId: string, chapterId: string | undefined, title: string, input: unknown, expectedUpdatedAt: string): Promise<{ ok: boolean; chapterId?: string; updatedAt?: string; message?: string }> {
  try {
    const { supabase, user } = await requireOwnedWorkForAction(workId);
    const parsedTitle = z.string().trim().min(1).max(120).safeParse(title);
    if (!parsedTitle.success) return { ok: false, message: "Add a chapter title of 120 characters or fewer." };
    const { document, plainText } = validateRichDocument(input, user.id, workId);
    if (!chapterId) {
      const { data, error } = await supabase.from("chapters").insert({ work_id: workId, title: parsedTitle.data, body: plainText, format: "prose", content: { type: "rich", document }, state: "draft" }).select("id,updated_at").single();
      if (error || !data) return { ok: false, message: "The chapter draft could not be saved." };
      revalidatePath(`/studio/${workId}`);
      return { ok: true, chapterId: data.id, updatedAt: data.updated_at };
    }
    if (!z.uuid().safeParse(chapterId).success || !Number.isFinite(Date.parse(expectedUpdatedAt))) return { ok: false, message: "Reload this chapter before saving." };
    const { data: chapter } = await supabase.from("chapters").select("id,state,updated_at").eq("id", chapterId).eq("work_id", workId).maybeSingle();
    if (!chapter) return { ok: false, message: "This chapter is no longer available." };
    const { data: draft } = await supabase.from("chapter_drafts").select("updated_at").eq("work_id", workId).eq("chapter_id", chapterId).maybeSingle();
    const staged = chapter.state === "published" || !!draft;
    const currentVersion = draft?.updated_at ?? chapter.updated_at;
    if (currentVersion !== expectedUpdatedAt) return { ok: false, message: "This chapter changed in another session. Reload before saving." };
    const fields = { title: parsedTitle.data, body: plainText, format: "prose", content: { type: "rich", document } };
    const result = staged
      ? draft
        ? await supabase.from("chapter_drafts").update({ ...fields, updated_at: new Date().toISOString() }).eq("work_id", workId).eq("chapter_id", chapterId).eq("updated_at", currentVersion).select("updated_at").single()
        : await supabase.from("chapter_drafts").insert({ work_id: workId, chapter_id: chapterId, ...fields }).select("updated_at").single()
      : await supabase.from("chapters").update(fields).eq("id", chapterId).eq("work_id", workId).eq("state", "draft").eq("updated_at", currentVersion).select("updated_at").single();
    if (result.error || !result.data) return { ok: false, message: "This chapter changed before the save completed. Reload and try again." };
    await cleanupUnreferencedStoryMedia(supabase, user.id, workId);
    revalidatePath(`/studio/${workId}`); revalidatePath(`/work/${workId}/chapter/${chapterId}`);
    return { ok: true, chapterId, updatedAt: result.data.updated_at };
  } catch (error) {
    if (error instanceof RichDocumentValidationError) {
      console.warn("[rich-document-validation]", error.diagnostic);
      return { ok: false, message: safeRichDocumentErrorMessage(error) };
    }
    return { ok: false, message: "The chapter could not be saved. Your writing is still open in the editor; please retry." };
  }
}

export async function saveChapterReview(_previous: ReviewActionState, form: FormData): Promise<ReviewActionState> {
  const parsed = chapterReviewSchema.safeParse({
    workId: value(form, "workId"),
    chapterId: value(form, "chapterId"),
    rating: value(form, "rating"),
    body: value(form, "body"),
  });
  if (!parsed.success) return { kind: "error", message: "Choose a rating and keep your review under 2,000 characters." };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { kind: "error", message: "Sign in to leave a review." };
    const { error } = await supabase.from("chapter_reviews").upsert({
      work_id: parsed.data.workId,
      chapter_id: parsed.data.chapterId,
      user_id: user.id,
      rating: parsed.data.rating,
      body: parsed.data.body,
    }, { onConflict: "chapter_id,user_id" });
    if (error) {
      console.warn("[chapter-review] save rejected", { code: error.code ?? "unknown" });
      return { kind: "error", message: "This chapter is not available for reviews right now." };
    }
    revalidatePath(`/work/${parsed.data.workId}`);
    revalidatePath(`/work/${parsed.data.workId}/chapter/${parsed.data.chapterId}`);
    return { kind: "success", message: "Review saved." };
  } catch {
    return { kind: "error", message: "We couldn't save your review. Please try again." };
  }
}

export async function deleteChapterReview(_previous: ReviewActionState, form: FormData): Promise<ReviewActionState> {
  const parsed = chapterReviewSchema.pick({ workId: true, chapterId: true }).safeParse({
    workId: value(form, "workId"),
    chapterId: value(form, "chapterId"),
  });
  if (!parsed.success) return { kind: "error", message: "That review could not be found." };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { kind: "error", message: "Sign in to manage your review." };
    const { error } = await supabase.from("chapter_reviews").delete().eq("work_id", parsed.data.workId).eq("chapter_id", parsed.data.chapterId).eq("user_id", user.id);
    if (error) {
      console.warn("[chapter-review] delete rejected", { code: error.code ?? "unknown" });
      return { kind: "error", message: "We couldn't delete your review. Please try again." };
    }
    revalidatePath(`/work/${parsed.data.workId}`);
    revalidatePath(`/work/${parsed.data.workId}/chapter/${parsed.data.chapterId}`);
    return { kind: "success", message: "Review deleted." };
  } catch {
    return { kind: "error", message: "We couldn't delete your review. Please try again." };
  }
}
