import { ChapterReviews } from "@/components/chapter-reviews";
import { getChapterReviews } from "@/lib/chapter-reviews";
import { createClient } from "@/lib/supabase/server";

export async function ChapterReviewsLoader({ workId, chapterId, authorId, currentUserId, loginHref }: { workId: string; chapterId: string; authorId: string; currentUserId?: string; loginHref: string }) {
  const supabase = await createClient();
  const reviews = await getChapterReviews(supabase, workId, chapterId, authorId);
  return <ChapterReviews workId={workId} chapterId={chapterId} authorId={authorId} reviews={reviews} currentUserId={currentUserId} loginHref={loginHref}/>;
}
