import { createClient } from "@/lib/supabase/server";
import { signStoryMediaUrls } from "@/lib/story-media";

type BookmarkRow = { work_id: string; created_at: string };
type ProgressRow = { work_id: string; chapter_id: string; progress: number; updated_at: string };
type WorkRow = {
  id: string;
  title: string;
  summary: string;
  cover_url: string | null;
  tags: string[];
  content_warnings: string[];
  profiles: { username: string; display_name: string } | null;
};
type ChapterRow = { id: string; title: string };

export type ShelfItem = {
  id: string;
  title: string;
  summary: string;
  coverPreviewUrl: string | null;
  tags: string[];
  contentWarnings: string[];
  author: { username: string; displayName: string } | null;
  bookmarkCreatedAt: string | null;
  progress: number | null;
  progressUpdatedAt: string | null;
  chapterTitle: string | null;
};

export type ShelfData =
  | { status: "unauthenticated" }
  | { status: "unavailable" }
  | {
      status: "ready";
      bookmarked: ShelfItem[];
      currentlyReading: ShelfItem[];
      recentlyFinished: ShelfItem[];
    };

const emptyShelf = (): Extract<ShelfData, { status: "ready" }> => ({
  status: "ready",
  bookmarked: [],
  currentlyReading: [],
  recentlyFinished: [],
});

function byNewest(left: string | null, right: string | null): number {
  return (right ? Date.parse(right) : 0) - (left ? Date.parse(left) : 0);
}

export function classifyShelfItems(items: ShelfItem[]): Extract<ShelfData, { status: "ready" }> {
  const shelf = emptyShelf();

  for (const item of items) {
    if (item.bookmarkCreatedAt) shelf.bookmarked.push(item);
    if (item.progress !== null && item.progress > 0 && item.progress < 1) shelf.currentlyReading.push(item);
    if (item.progress !== null && item.progress >= 1) shelf.recentlyFinished.push(item);
  }

  shelf.bookmarked.sort((left, right) => byNewest(left.bookmarkCreatedAt, right.bookmarkCreatedAt));
  shelf.currentlyReading.sort((left, right) => byNewest(left.progressUpdatedAt, right.progressUpdatedAt));
  shelf.recentlyFinished.sort((left, right) => byNewest(left.progressUpdatedAt, right.progressUpdatedAt));
  return shelf;
}

export async function getShelf(): Promise<ShelfData> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { status: "unauthenticated" };

    const [{ data: bookmarkRows, error: bookmarkError }, { data: progressRows, error: progressError }] = await Promise.all([
      supabase.from("user_bookmarks").select("work_id,created_at").eq("user_id", user.id),
      supabase.from("reading_progress").select("work_id,chapter_id,progress,updated_at").eq("user_id", user.id),
    ]);
    if (bookmarkError || progressError) return { status: "unavailable" };

    const bookmarks = (bookmarkRows ?? []) as BookmarkRow[];
    const progress = (progressRows ?? []) as ProgressRow[];
    const workIds = [...new Set([...bookmarks.map((row) => row.work_id), ...progress.map((row) => row.work_id)])];
    if (workIds.length === 0) return emptyShelf();

    const chapterIds = [...new Set(progress.map((row) => row.chapter_id))];
    const [{ data: workRows, error: workError }, { data: chapterRows, error: chapterError }] = await Promise.all([
      supabase.from("works").select("id,title,summary,cover_url,tags,content_warnings,profiles(username,display_name)").in("id", workIds),
      chapterIds.length ? supabase.from("chapters").select("id,title").in("id", chapterIds) : Promise.resolve({ data: [] as ChapterRow[], error: null }),
    ]);
    if (workError || chapterError) return { status: "unavailable" };

    const works = (workRows ?? []) as unknown as WorkRow[];
    const chapters = new Map((chapterRows ?? []).map((chapter) => [chapter.id, chapter.title]));
    const bookmarkByWork = new Map(bookmarks.map((bookmark) => [bookmark.work_id, bookmark.created_at]));
    const progressByWork = new Map(progress.map((entry) => [entry.work_id, entry]));
    const coverUrls = await signStoryMediaUrls(supabase, works.map((work) => work.cover_url));
    const items = works.map((work): ShelfItem => {
      const savedProgress = progressByWork.get(work.id);
      return {
        id: work.id,
        title: work.title,
        summary: work.summary,
        coverPreviewUrl: work.cover_url ? coverUrls.get(work.cover_url) ?? null : null,
        tags: work.tags ?? [],
        contentWarnings: work.content_warnings ?? [],
        author: work.profiles ? { username: work.profiles.username, displayName: work.profiles.display_name } : null,
        bookmarkCreatedAt: bookmarkByWork.get(work.id) ?? null,
        progress: savedProgress?.progress ?? null,
        progressUpdatedAt: savedProgress?.updated_at ?? null,
        chapterTitle: savedProgress ? chapters.get(savedProgress.chapter_id) ?? null : null,
      };
    });

    return classifyShelfItems(items);
  } catch {
    return { status: "unavailable" };
  }
}
