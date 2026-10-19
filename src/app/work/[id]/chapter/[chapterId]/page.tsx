import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ChapterPage({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const { id, chapterId } = await params;
  const supabase = await createClient();
  const { data: chapter } = await supabase.from("chapters").select("id,title,body,position,works(id,title,visibility,profiles(username,display_name))").eq("id", chapterId).eq("work_id", id).maybeSingle();
  if (!chapter) notFound();
  const work = chapter.works as unknown as { id: string; title: string; visibility: string; profiles: { username: string; display_name: string } | null };
  return <main className="reader"><Link href={`/work/${id}`} className="byline">← {work.title}</Link><h1>{chapter.title}</h1><p className="byline">Chapter {chapter.position}{work.profiles ? <> · By <Link href={`/author/${work.profiles.username}`}>{work.profiles.display_name}</Link></> : null}</p><article className="reader-content">{chapter.body}</article><hr style={{borderColor:"var(--line)",margin:"54px 0 30px"}}/><Link href={`/work/${id}`} className="pill">Back to chapters</Link></main>;
}
