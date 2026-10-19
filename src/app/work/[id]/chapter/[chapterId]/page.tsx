import Link from "next/link";
import { notFound } from "next/navigation";
import { ReaderExperience } from "@/components/reader-experience";
import { normalizeReaderContent } from "@/lib/chapter-content";
import { createClient } from "@/lib/supabase/server";

type Chapter = { id: string; title: string; body: string; position: number; work_id: string; format?: string; content?: unknown; state?: string; updated_at?: string };
type ChapterLink = { id: string; title: string; position: number };

export default async function ChapterPage({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const { id, chapterId } = await params;
  const supabase = await createClient();
  const [{ data: { user } }, { data: visibleChapter }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("chapters").select("id,title,body,position,work_id,format,content,state,updated_at").eq("id", chapterId).eq("work_id", id).maybeSingle(),
  ]);
  let chapter = visibleChapter as Chapter | null;
  let viaUnlistedLink = false;
  if (!chapter) {
    const { data } = await supabase.rpc("read_unlisted_chapter", { p_work_id: id, p_chapter_id: chapterId });
    chapter = (data?.[0] as Chapter | undefined) ?? null;
    viaUnlistedLink = !!chapter;
  }
  if (!chapter) notFound();
  let work = (await supabase.from("works").select("id,title,author_id").eq("id", id).maybeSingle()).data;
  if (!work && viaUnlistedLink) work = (await supabase.rpc("read_unlisted_work", { p_work_id: id })).data?.[0] ?? null;
  if (!work) notFound();
  const isOwner = user?.id === work.author_id;
  const listResult = viaUnlistedLink
    ? await supabase.rpc("read_unlisted_chapters", { p_work_id: id })
    : await supabase.from("chapters").select("id,title,position").eq("work_id", id).order("position");
  const chapters = (listResult.data ?? []) as ChapterLink[];
  const saved = user ? (await supabase.from("reading_progress").select("chapter_id,progress").eq("user_id", user.id).eq("work_id", id).maybeSingle()).data : null;

  return <>
    {isOwner && <div className="reader-owner-link"><Link href={`/studio/${id}?chapter=${chapterId}`}>Edit this chapter in Creator Studio →</Link></div>}
    <ReaderExperience workId={id} chapterId={chapterId} chapterTitle={chapter.title} content={normalizeReaderContent(chapter.content, chapter.body)} chapters={chapters} authenticated={!!user} savedProgress={saved?.chapter_id === chapterId ? saved.progress : 0}/>
  </>;
}
