import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ChapterPage({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const { id, chapterId } = await params;
  const supabase = await createClient();
  const { data: visibleChapter } = await supabase.from("chapters").select("id,title,body,position,work_id").eq("id", chapterId).eq("work_id", id).maybeSingle();
  let chapter = visibleChapter;
  let unlistedChapter = false;
  if (!chapter) {
    const { data } = await supabase.rpc("read_unlisted_chapter", { p_work_id: id, p_chapter_id: chapterId });
    chapter = data?.[0] ?? null;
    unlistedChapter = !!chapter;
  }
  if (!chapter) notFound();
  const { data: visibleWork } = await supabase.from("works").select("id,title,author_id").eq("id", id).maybeSingle();
  let work = visibleWork;
  if (!work && unlistedChapter) {
    const { data } = await supabase.rpc("read_unlisted_work", { p_work_id: id });
    work = data?.[0] ?? null;
  }
  if (!work) notFound();
  const { data: author } = await supabase.from("profiles").select("username,display_name").eq("id", work.author_id).maybeSingle();
  return <main className="reader"><Link href={`/work/${id}`} className="byline">← {work.title}</Link><h1>{chapter.title}</h1><p className="byline">Chapter {chapter.position}{author ? <> · By <Link href={`/author/${author.username}`}>{author.display_name}</Link></> : null}</p><article className="reader-content">{chapter.body}</article><hr style={{borderColor:"var(--line)",margin:"54px 0 30px"}}/><Link href={`/work/${id}`} className="pill">Back to chapters</Link></main>;
}
