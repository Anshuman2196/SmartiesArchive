import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const chapterReviewSchema = z.object({
  workId: z.uuid(),
  chapterId: z.uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().max(2000),
});

export type ReviewActionState = {
  kind: "idle" | "error" | "success";
  message?: string;
};

export type ChapterReview = {
  id: string;
  workId: string;
  chapterId: string;
  userId: string;
  rating: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: { username: string; displayName: string } | null;
};

export type ChapterReviewSummary = {
  count: number;
  average: number;
};

const reviewRowSchema = z.object({
  id: z.uuid(),
  work_id: z.uuid(),
  chapter_id: z.uuid(),
  user_id: z.uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

type ProfileRow = { id: string; username: string; display_name: string };

function normalizeReviews(rows: unknown, profiles: ProfileRow[]): ChapterReview[] {
  if (!Array.isArray(rows)) return [];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  return rows.flatMap((row) => {
    const parsed = reviewRowSchema.safeParse(row);
    if (!parsed.success) return [];
    const value = parsed.data;
    const profile = profileById.get(value.user_id);
    return [{
      id: value.id,
      workId: value.work_id,
      chapterId: value.chapter_id,
      userId: value.user_id,
      rating: value.rating,
      body: value.body,
      createdAt: value.created_at,
      updatedAt: value.updated_at,
      author: profile ? { username: profile.username, displayName: profile.display_name } : null,
    }];
  });
}

async function loadProfiles(supabase: SupabaseClient, userIds: string[]): Promise<ProfileRow[]> {
  if (userIds.length === 0) return [];
  const { data } = await supabase.from("profiles").select("id,username,display_name").in("id", userIds);
  return (data ?? []) as ProfileRow[];
}

export async function getChapterReviews(supabase: SupabaseClient, workId: string, chapterId: string): Promise<ChapterReview[]> {
  const { data, error } = await supabase
    .from("chapter_reviews")
    .select("id,work_id,chapter_id,user_id,rating,body,created_at,updated_at")
    .eq("work_id", workId)
    .eq("chapter_id", chapterId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  const profiles = await loadProfiles(supabase, data.map((review) => review.user_id));
  return normalizeReviews(data, profiles);
}

export async function getChapterReviewSummaries(supabase: SupabaseClient, chapterIds: string[]): Promise<Record<string, ChapterReviewSummary>> {
  if (chapterIds.length === 0) return {};
  const { data, error } = await supabase.from("chapter_reviews").select("chapter_id,rating").in("chapter_id", chapterIds);
  if (error || !data) return {};
  return data.reduce<Record<string, ChapterReviewSummary>>((summaries, row) => {
    const current = summaries[row.chapter_id] ?? { count: 0, average: 0 };
    current.average = ((current.average * current.count) + row.rating) / (current.count + 1);
    current.count += 1;
    summaries[row.chapter_id] = current;
    return summaries;
  }, {});
}
