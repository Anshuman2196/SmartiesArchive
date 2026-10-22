import type { SupabaseClient } from "@supabase/supabase-js";

export async function persistReadingProgress(supabase: SupabaseClient, workId: string, chapterId: string, progress: number): Promise<boolean> {
  const { data, error } = await supabase.rpc("save_reading_progress", {
    p_work_id: workId,
    p_chapter_id: chapterId,
    p_progress: progress,
  });
  return !error && data === true;
}
