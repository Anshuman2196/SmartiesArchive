import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Chapter = { id: string; title: string; position: number; state: "draft" | "published" };
type Work = { id: string; title: string; summary: string; visibility: "public" | "unlisted" | "private"; state: "draft" | "published"; author_id: string };
export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: ownedOrPublicWork } = await supabase.from("works").select("id,title,summary,visibility,state,author_id").eq("id", id).maybeSingle();
  let work = ownedOrPublicWork as Work | null;
  let readByUnlistedLink = false;
  if (!work) {
    const { data } = await supabase.rpc("read_unlisted_work", { p_work_id: id });
    work = (data?.[0] as Work | undefined) ?? null;
    readByUnlistedLink = !!work;
  }
  if (!work) notFound();
  const chapterQuery = readByUnlistedLink
    ? supabase.rpc("read_unlisted_chapters", { p_work_id: id })
    : supabase.from("chapters").select("id,title,position,state").eq("work_id", id).order("position");
  const [{ data: chapters }, { data: author }] = await Promise.all([
    chapterQuery,
    supabase.from("profiles").select("username,display_name").eq("id", work.author_id).maybeSingle(),
  ]);
  const list = (chapters ?? []) as Chapter[];
  return <main className="reader"><span className="eyebrow">{work.visibility === "private" ? "Private draft" : "A story in the archive"}</span><h1>{work.title}</h1><p className="muted">{work.summary}</p>{author && <p className="byline">By <Link href={`/author/${author.username}`}>{author.display_name}</Link></p>}<hr style={{borderColor:"var(--line)",margin:"35px 0"}}/><h2 className="serif" style={{fontWeight:400}}>Chapters</h2>{list.length ? <ol style={{paddingLeft:20,lineHeight:2}}>{list.map((chapter) => <li key={chapter.id}><Link href={`/work/${id}/chapter/${chapter.id}`}>{chapter.title}</Link>{chapter.state === "draft" && <span className="tag"> · draft</span>}</li>)}</ol> : <p className="muted">The first chapter is still being written.</p>}</main>;
}
