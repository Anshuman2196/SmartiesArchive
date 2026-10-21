"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";

const uuidSchema = z.uuid();

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function adminUnpublishWork(formData: FormData) {
  const workId = formValue(formData, "workId");
  if (!uuidSchema.safeParse(workId).success) redirect("/admin?status=invalid");

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_unpublish_work", { p_work_id: workId });
  if (error || data !== true) redirect("/admin?status=unchanged");

  revalidatePath("/admin");
  revalidatePath("/library");
  revalidatePath(`/work/${workId}`);
  redirect("/admin?status=work_unpublished");
}

export async function adminUnpublishChapter(formData: FormData) {
  const workId = formValue(formData, "workId");
  const chapterId = formValue(formData, "chapterId");
  if (!uuidSchema.safeParse(workId).success || !uuidSchema.safeParse(chapterId).success) redirect("/admin?status=invalid");

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_unpublish_chapter", { p_work_id: workId, p_chapter_id: chapterId });
  if (error || data !== true) redirect("/admin?status=unchanged");

  revalidatePath("/admin");
  revalidatePath("/library");
  revalidatePath(`/work/${workId}`);
  revalidatePath(`/work/${workId}/chapter/${chapterId}`);
  redirect("/admin?status=chapter_unpublished");
}
