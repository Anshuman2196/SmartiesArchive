import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { ChapterReviewsLoader } from "@/components/chapter-reviews-loader";
import { ContentWarningGate } from "@/components/content-warning-gate";
import { ReaderExperience } from "@/components/reader-experience";
import { normalizeReaderContent } from "@/lib/chapter-content";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { signRichDocument, signStoryMediaUrl, signStoryMediaUrls } from "@/lib/story-media";
import type { Metadata } from "next";

type Chapter = { id: string; title: string; body: string; position: number; work_id: string; format?: string; content?: unknown; state?: string; updated_at?: string };
type ChapterLink = { id: string; title: string; position: number; state?: string };
type Work = { id: string; title: string; author_id: string; tags?: string[]; content_warnings?: string[] };
type Author = { username: string; display_name: string };

export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string; chapterId: string }>; searchParams: Promise<{ preview?: string }> }): Promise<Metadata> {
  const { id, chapterId } = await params;
  const { preview } = await searchParams;
  const supabase = await createClient();
  let [{ data: chapter }, { data: work }] = await Promise.all([
    supabase.from("chapters").select("title,state").eq("id", chapterId).eq("work_id", id).maybeSingle(),
    supabase.from("works").select("title,visibility,state").eq("id", id).maybeSingle(),
  ]);
  if (!chapter) chapter = (await supabase.rpc("read_unlisted_chapter", { p_work_id: id, p_chapter_id: chapterId })).data?.[0] ?? null;
  if (!work) work = (await supabase.rpc("read_unlisted_work", { p_work_id: id })).data?.[0] ?? null;
  if (!chapter || !work) return { title: "Chapter not found", robots: { index: false, follow: false } };
  const hidden = work.visibility !== "public" || work.state !== "published" || chapter.state !== "published" || preview === "draft";
  const title = `${chapter.title} — ${work.title}`;
  return { title, description: `Read ${chapter.title} from ${work.title} in Smarties Archive.`, robots: hidden ? { index: false, follow: false } : { index: true, follow: true }, openGraph: { title, type: "article", images: ["/images/archive-cover-default.webp"] } };
}

export default async function ChapterPage({ params, searchParams }: { params: Promise<{ id: string; chapterId: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { id, chapterId } = await params;
  const { preview } = await searchParams;
  const supabase = await createClient();
  const [user, { data: visibleChapter }, { data: visibleWork }] = await Promise.all([
    getCurrentUser(),
    supabase.from("chapters").select("id,title,body,position,work_id,format,content,state,updated_at").eq("id", chapterId).eq("work_id", id).maybeSingle(),
    supabase.from("works").select("id,title,author_id,tags,content_warnings").eq("id", id).maybeSingle(),
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
  if (chapter.state === "draft" && !isOwner) notFound();
  const warnings = work.content_warnings ?? [];
  const warningAccepted = !warnings.length || (await cookies()).get(`smarties-warning-${id}`)?.value === "accepted";
  if (!warningAccepted) return <>
    {isOwner && <div className="reader-owner-link"><Link href={`/studio/${id}?chapter=${chapterId}`}>Edit this chapter in Creator Studio</Link></div>}
    <ContentWarningGate workId={id} chapterId={chapterId} title={work.title} warnings={warnings} preview={isOwner && preview === "draft" ? "draft" : undefined}/>
  </>;
  const wantsDraftPreview = isOwner && preview === "draft";
  const { data: chapterDraft } = wantsDraftPreview
    ? await supabase.from("chapter_drafts").select("title,body,format,content").eq("work_id", id).eq("chapter_id", chapterId).maybeSingle()
    : { data: null };
  const previewingDraft = wantsDraftPreview && (chapter.state === "draft" || !!chapterDraft);
  const displayedChapter = chapterDraft ?? chapter;
  const contentPromise = (async () => {
    let nextContent = normalizeReaderContent(displayedChapter.content, displayedChapter.body, work.author_id, id);
    if (nextContent.type === "rich") nextContent = { ...nextContent, document: await signRichDocument(nextContent.document, supabase) as typeof nextContent.document };
    if (nextContent.type === "comic") {
      const signedPanels = await signStoryMediaUrls(supabase, nextContent.panels.map((panel) => panel.url));
      nextContent = { ...nextContent, panels: nextContent.panels.map((panel) => ({ ...panel, url: signedPanels.get(panel.url) ?? panel.url })) };
    }
    if (nextContent.type === "pdf") {
      const signedUrl = await signStoryMediaUrl(supabase, nextContent.url);
      if (signedUrl) nextContent = { ...nextContent, url: signedUrl };
    }
    return nextContent;
  })();
  const listResultPromise = viaUnlistedLink
    ? supabase.rpc("read_unlisted_chapters", { p_work_id: id })
    : supabase.from("chapters").select("id,title,position,state").eq("work_id", id).order("position");
  const savedPromise = user && !previewingDraft
    ? supabase.from("reading_progress").select("chapter_id,progress").eq("user_id", user.id).eq("work_id", id).maybeSingle()
    : Promise.resolve({ data: null });
  const bookmarkPromise = user && !previewingDraft
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
  const readerChapters = isOwner ? chapters : chapters.filter((item) => item.state === "published");
  const saved = savedResult.data;
  const author = authorResult.data as Author | null;

  return <>
    {isOwner && <div className="reader-owner-link"><Link href={`/studio/${id}?chapter=${chapterId}`}>Edit this chapter in Creator Studio</Link></div>}
    <ReaderExperience workId={id} chapterId={chapterId} workTitle={work.title} author={author ? { displayName: author.display_name, username: author.username } : undefined} tags={work.tags} canReview={!isOwner} chapterTitle={displayedChapter.title} content={content} chapters={readerChapters} authenticated={!!user} previewingDraft={previewingDraft} initialSaved={!!bookmarkResult.data} savedProgress={saved?.chapter_id === chapterId ? saved.progress : 0}>
      {!previewingDraft && <Suspense fallback={<section className="shell" aria-busy="true"><p className="muted" role="status">Loading reader notes…</p></section>}>
        <ChapterReviewsLoader workId={id} chapterId={chapterId} authorId={work.author_id} currentUserId={user?.id} loginHref={`/auth?mode=login&next=${encodeURIComponent(`/work/${id}/chapter/${chapterId}`)}`}/>
      </Suspense>}
    </ReaderExperience>
  </>;
}
