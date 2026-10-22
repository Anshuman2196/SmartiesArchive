import type { SupabaseClient } from "@supabase/supabase-js";

export async function persistReadingProgress(supabase: SupabaseClient, userId: string, workId: string, chapterId: string, progress: number): Promise<boolean> {
  const [{ data: chapter }, { data: previous }] = await Promise.all([
    supabase.from("chapters").select("id,position,state").eq("id", chapterId).eq("work_id", workId).maybeSingle(),
    supabase.from("reading_progress").select("chapter_id,progress").eq("user_id", userId).eq("work_id", workId).maybeSingle(),
  ]);
  if (!chapter || chapter.state !== "published") return false;

  const timestamp = new Date().toISOString();
  if (previous?.chapter_id && previous.chapter_id !== chapterId) {
    const { data: previousChapter } = await supabase.from("chapters").select("position,state").eq("id", previous.chapter_id).eq("work_id", workId).maybeSingle();
    if (previousChapter?.state === "published" && previousChapter.position > chapter.position) {
      const { error } = await supabase.from("reading_progress").upsert({ user_id: userId, work_id: workId, chapter_id: previous.chapter_id, progress: previous.progress, updated_at: timestamp }, { onConflict: "user_id,work_id" });
      return !error;
    }
  }

  const { error } = await supabase.from("reading_progress").upsert({ user_id: userId, work_id: workId, chapter_id: chapterId, progress, updated_at: timestamp }, { onConflict: "user_id,work_id" });
  return !error;
}
