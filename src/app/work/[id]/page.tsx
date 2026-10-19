import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Chapter = { id: string; title: string; position: number; state: "draft" | "published" };
export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: work } = await supabase.from("works").select("id,title,summary,visibility,state,profiles(username,display_name)").eq("id", id).maybeSingle();
  if (!work) notFound();
  const { data: chapters } = await supabase.from("chapters").select("id,title,position,state").eq("work_id", id).order("position");
  const author = work.profiles as unknown as { username: string; display_name: string } | null;
  const list = (chapters ?? []) as Chapter[];
  return <main className="reader"><span className="eyebrow">{work.visibility === "private" ? "Private draft" : "A story in the archive"}</span><h1>{work.title}</h1><p className="muted">{work.summary}</p>{author && <p className="byline">By <Link href={`/author/${author.username}`}>{author.display_name}</Link></p>}<hr style={{borderColor:"var(--line)",margin:"35px 0"}}/><h2 className="serif" style={{fontWeight:400}}>Chapters</h2>{list.length ? <ol style={{paddingLeft:20,lineHeight:2}}>{list.map((chapter) => <li key={chapter.id}><Link href={`/work/${id}/chapter/${chapter.id}`}>{chapter.title}</Link>{chapter.state === "draft" && <span className="tag"> · draft</span>}</li>)}</ol> : <p className="muted">The first chapter is still being written.</p>}</main>;
}
