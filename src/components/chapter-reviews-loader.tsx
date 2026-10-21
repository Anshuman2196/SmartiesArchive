import { ChapterReviews } from "@/components/chapter-reviews";
import { getChapterReviews } from "@/lib/chapter-reviews";
import { createClient } from "@/lib/supabase/server";

export async function ChapterReviewsLoader({ workId, chapterId, currentUserId, loginHref }: { workId: string; chapterId: string; currentUserId?: string; loginHref: string }) {
  const supabase = await createClient();
  const reviews = await getChapterReviews(supabase, workId, chapterId);
  return <ChapterReviews workId={workId} chapterId={chapterId} reviews={reviews} currentUserId={currentUserId} loginHref={loginHref}/>;
}
