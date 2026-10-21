import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChapterReviewsLoader } from "@/components/chapter-reviews-loader";
import { ReaderExperience } from "@/components/reader-experience";
import { normalizeReaderContent } from "@/lib/chapter-content";
import { createClient } from "@/lib/supabase/server";
import { signRichDocument, signStoryMediaUrl } from "@/lib/story-media";

type Chapter = { id: string; title: string; body: string; position: number; work_id: string; format?: string; content?: unknown; state?: string; updated_at?: string };
type ChapterLink = { id: string; title: string; position: number };
type Work = { id: string; title: string; author_id: string; content_warnings?: string[] };
type Author = { username: string; display_name: string };

export default async function ChapterPage({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const { id, chapterId } = await params;
  const supabase = await createClient();
  const [{ data: { user } }, { data: visibleChapter }, { data: visibleWork }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("chapters").select("id,title,body,position,work_id,format,content,state,updated_at").eq("id", chapterId).eq("work_id", id).maybeSingle(),
    supabase.from("works").select("id,title,author_id,content_warnings").eq("id", id).maybeSingle(),
  ]);
  let chapter = visibleChapter as Chapter | null;
  let viaUnlistedLink = false;
  if (!chapter) {
    const { data } = await supabase.rpc("read_unlisted_chapter", { p_work_id: id, p_chapter_id: chapterId });
    chapter = (data?.[0] as Chapter | undefined) ?? null;
    viaUnlistedLink = !!chapter;
  }
  if (!chapter) notFound();
  let work = visibleWork as Work | null;
  if (!work && viaUnlistedLink) work = (await supabase.rpc("read_unlisted_work", { p_work_id: id })).data?.[0] ?? null;
  if (!work) notFound();
  const isOwner = user?.id === work.author_id;
  const contentPromise = (async () => {
    let nextContent = normalizeReaderContent(chapter.content, chapter.body, work.author_id, id);
    if (nextContent.type === "rich") nextContent = { ...nextContent, document: await signRichDocument(nextContent.document, supabase) as typeof nextContent.document };
    if (nextContent.type === "pdf") {
      const signedUrl = await signStoryMediaUrl(supabase, nextContent.url);
      if (signedUrl) nextContent = { ...nextContent, url: signedUrl };
    }
    return nextContent;
  })();
  const listResultPromise = viaUnlistedLink
    ? supabase.rpc("read_unlisted_chapters", { p_work_id: id })
    : supabase.from("chapters").select("id,title,position").eq("work_id", id).order("position");
  const savedPromise = user
    ? supabase.from("reading_progress").select("chapter_id,progress").eq("user_id", user.id).eq("work_id", id).maybeSingle()
    : Promise.resolve({ data: null });
  const bookmarkPromise = user
    ? supabase.from("user_bookmarks").select("work_id").eq("user_id", user.id).eq("work_id", id).maybeSingle()
    : Promise.resolve({ data: null });
  const authorPromise = supabase.from("profiles").select("username,display_name").eq("id", work.author_id).maybeSingle();
  const [content, listResult, savedResult, bookmarkResult, authorResult] = await Promise.all([
    contentPromise,
    listResultPromise,
    savedPromise,
    bookmarkPromise,
    authorPromise,
  ]);
  const chapters = (listResult.data ?? []) as ChapterLink[];
  const saved = savedResult.data;
  const author = authorResult.data as Author | null;

  return <>
    {isOwner && <div className="reader-owner-link"><Link href={`/studio/${id}?chapter=${chapterId}`}>Edit this chapter in Creator Studio</Link></div>}
    <ReaderExperience workId={id} chapterId={chapterId} workTitle={work.title} author={author ? { displayName: author.display_name, username: author.username } : undefined} contentWarnings={work.content_warnings ?? []} chapterTitle={chapter.title} content={content} chapters={chapters} authenticated={!!user} initialSaved={!!bookmarkResult.data} savedProgress={saved?.chapter_id === chapterId ? saved.progress : 0}>
      <Suspense fallback={<section className="shell" aria-busy="true"><p className="muted" role="status">Loading reader notes…</p></section>}>
        <ChapterReviewsLoader workId={id} chapterId={chapterId} currentUserId={user?.id} loginHref={`/auth?mode=login&next=${encodeURIComponent(`/work/${id}/chapter/${chapterId}`)}`}/>
      </Suspense>
    </ReaderExperience>
  </>;
}
