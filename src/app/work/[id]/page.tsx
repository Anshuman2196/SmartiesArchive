import Image from "next/image";
import Link from "next/link";
import { CoverFallback } from "@/components/cover-fallback";
import { notFound } from "next/navigation";
import { BookmarkButton, ResumeLink, ShareButton } from "@/components/reader-experience";
import { getChapterReviewSummaries } from "@/lib/chapter-reviews";
import { isSecureMediaUrl } from "@/lib/reader-state";
import { signStoryMediaUrl } from "@/lib/story-media";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { workVisibilityLabel } from "@/lib/work-visibility";
import type { Metadata } from "next";

type Chapter = { id: string; title: string; position: number; state: "draft" | "published"; format?: string };
type Work = { id: string; title: string; summary: string; visibility: "public" | "unlisted" | "private"; state: "draft" | "published"; author_id: string; cover_url?: string; tags?: string[]; content_warnings?: string[] };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  let { data: work } = await supabase.from("works").select("title,summary,visibility,state").eq("id", id).maybeSingle();
  if (!work) work = (await supabase.rpc("read_unlisted_work", { p_work_id: id })).data?.[0] ?? null;
  if (!work) return { title: "Story not found" };
  const description = work.summary || `Read ${work.title} in Smarties Archive.`;
  const hidden = work.visibility !== "public" || work.state !== "published";
  return { title: work.title, description, robots: hidden ? { index: false, follow: false } : { index: true, follow: true }, openGraph: { title: work.title, description, type: "article", images: ["/images/archive-cover-default.webp"] } };
}

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [user, { data: visibleWork }] = await Promise.all([
    getCurrentUser(),
    supabase.from("works").select("id,title,summary,visibility,state,author_id,cover_url,tags,content_warnings").eq("id", id).maybeSingle(),
  ]);
  let work = visibleWork as Work | null;
  let viaShareLink = false;
  if (!work) {
    const { data } = await supabase.rpc("read_unlisted_work", { p_work_id: id });
    work = (data?.[0] as Work | undefined) ?? null;
    viaShareLink = !!work;
  }
  if (!work) notFound();
  const [coverUrl, chaptersResult, { data: author }] = await Promise.all([
    signStoryMediaUrl(supabase, work.cover_url),
    viaShareLink
      ? supabase.rpc("read_unlisted_chapters", { p_work_id: id })
      : supabase.from("chapters").select("id,title,position,state,format").eq("work_id", id).order("position"),
    supabase.from("profiles").select("username,display_name,bio").eq("id", work.author_id).maybeSingle(),
  ]);
  const chapters = (chaptersResult.data ?? []) as Chapter[];
  const isOwner = user?.id === work.author_id;
  const published = chapters.filter((chapter) => chapter.state === "published");
  const reviewSummariesPromise = getChapterReviewSummaries(supabase, published.map((chapter) => chapter.id), work.author_id);
  const bookmarkAndProgressPromise = user
    ? Promise.all([
      supabase.from("user_bookmarks").select("work_id").eq("work_id", work.id).eq("user_id", user.id).maybeSingle(),
      supabase.from("reading_progress").select("chapter_id,progress").eq("work_id", work.id).eq("user_id", user.id).maybeSingle(),
    ])
    : Promise.resolve([{ data: null }, { data: null }] as const);
  const [reviewSummaries, [{ data: bookmark }, { data: progress }]] = await Promise.all([reviewSummariesPromise, bookmarkAndProgressPromise]);
  const first = published[0];
  const resumeId = progress?.chapter_id && published.some((chapter) => chapter.id === progress.chapter_id) ? progress.chapter_id : undefined;
  const displayChapters = isOwner ? chapters : published;
  const visibilityLabel = workVisibilityLabel(work.visibility);

  return <main id="main-content" tabIndex={-1} className="shell story-page">
    <div className="story-cover-wrap">{isSecureMediaUrl(coverUrl ?? undefined) ? <Image className="story-cover" src={coverUrl!} alt={`Cover art for ${work.title}`} width={900} height={1200} unoptimized priority/> : <CoverFallback title={work.title} className="story-cover story-cover-placeholder"/>}</div>
    <div className="story-detail">
      <div className="story-heading"><span className="eyebrow">{work.state === "draft" ? "Work in progress" : work.visibility === "private" ? "Private" : work.visibility === "unlisted" ? "Shared by link" : "Public"}</span><h1 className="serif">{work.title}</h1>
        {author && <p className="story-byline">By <Link href={`/author/${author.username}`}>{author.display_name}</Link></p>}
        <div className="story-badges"><span>{published.length} {published.length === 1 ? "chapter" : "chapters"}</span>{work.state === "draft" && <span>Draft</span>}{(isOwner || work.visibility !== "public") && <span>{visibilityLabel}</span>}{displayChapters.some((chapter) => chapter.format && chapter.format !== "prose") && <span>Includes illustrated chapters</span>}</div>
        {(work.tags?.length ?? 0) > 0 && <ul className="story-tags" aria-label="Story tags">{work.tags?.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
        {(work.content_warnings?.length ?? 0) > 0 && <details className="content-warnings"><summary>Content notes</summary><ul>{work.content_warnings?.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}
        <div className="story-actions">{first && <ResumeLink workId={work.id} firstChapterId={first.id} savedChapterId={resumeId} chapterIds={published.map((chapter) => chapter.id)} allowGuestLocal={!user}/>}{isOwner && <Link className="pill" href={`/studio/${work.id}`}>Manage story</Link>}{work.state === "published" && work.visibility !== "private" && <ShareButton iconOnly/>}{user ? <BookmarkButton workId={work.id} initialSaved={!!bookmark} iconOnly/> : work.state === "published" && <Link className="text-action" href={`/auth?mode=login&next=${encodeURIComponent(`/work/${work.id}`)}`}>Sign in to bookmark</Link>}</div>
        {work.summary && <p className="story-summary">{work.summary}</p>}
      </div>
      <section className="story-contents" aria-labelledby="story-contents-title"><div className="section-head"><div><span className="eyebrow">The reading path</span><h2 id="story-contents-title" className="serif">Chapters</h2></div><span className="muted">{published.length} published</span></div>
        {displayChapters.length ? <ol className="story-chapter-list">{displayChapters.map((chapter, index) => { const summary = reviewSummaries[chapter.id]; const format = chapter.format && chapter.format !== "prose" ? ` · ${chapter.format === "comic" ? "Manga / comic" : chapter.format === "chat" ? "Chat fiction" : chapter.format === "pdf" ? "PDF chapter" : chapter.format === "mixed" ? "Mixed media" : "Illustrated chapter"}` : ""; return <li key={chapter.id}><span className="chapter-index">{String(index + 1).padStart(2, "0")}</span><div><Link href={`/work/${work.id}/chapter/${chapter.id}`} className="chapter-title">{chapter.title}</Link><span className="chapter-meta">{isOwner && chapter.state === "draft" ? "Draft" : "Chapter"}{format}{summary ? ` · ★ ${summary.average.toFixed(1)} (${summary.count})` : ""}</span></div>{isOwner && <Link href={`/studio/${work.id}?chapter=${chapter.id}`} className="chapter-manage">Edit</Link>}</li>; })}</ol> : <div className="card empty-chapters"><h3 className="serif">A story gathering its first words.</h3><p className="muted">The author has not published a chapter yet.</p>{isOwner && <Link className="pill primary" href={`/studio/${work.id}`}>Open Creator Studio</Link>}</div>}
      </section>
      {work.visibility === "unlisted" && <p className="share-note">This story is shared by link and does not appear in public search.</p>}
    </div>
  </main>;
}
