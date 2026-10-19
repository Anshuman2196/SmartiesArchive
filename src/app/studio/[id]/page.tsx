import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createChapter } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

type Chapter = { id: string; title: string; position: number; state: string };
export default async function WorkStudioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; message?: string }> }) {
  const { id } = await params; const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const { data: work } = await supabase.from("works").select("id,title,summary,visibility,state").eq("id", id).eq("author_id", user.id).maybeSingle();
  if (!work) notFound();
  const { data: chapters } = await supabase.from("chapters").select("id,title,position,state").eq("work_id", id).order("position");
  return <main className="shell section"><Link href="/studio" className="byline">← Your desk</Link><div className="studio-head"><span className="eyebrow">{work.visibility} · {work.state}</span><h1 className="serif" style={{fontSize:48,fontWeight:400,margin:"10px 0"}}>{work.title}</h1><p className="muted">{work.summary}</p></div>{query.error && <p role="alert" className="notice">{query.error}</p>}{query.message && <p role="status" className="notice">{query.message}</p>}<div className="split"><section className="card"><span className="eyebrow">Add a chapter</span><h2 className="serif" style={{fontWeight:400}}>Let it unfold.</h2><form action={createChapter}><input type="hidden" name="workId" value={id}/><div className="field"><label htmlFor="chapter-title">Chapter title</label><input id="chapter-title" name="title" maxLength={120} required/></div><div className="field"><label htmlFor="content">Chapter text</label><textarea id="content" name="content" required maxLength={100000} style={{minHeight:280}} placeholder="Write your story here. Paragraph breaks will be preserved."/></div><div className="field"><label htmlFor="publish">Save as</label><select id="publish" name="publish"><option value="draft">Draft</option><option value="published">Published</option></select></div><button type="submit" className="pill primary">Save chapter</button></form></section><section><span className="eyebrow">Contents</span><h2 className="serif" style={{fontWeight:400}}>Chapters</h2>{chapters?.length ? <ol className="card" style={{paddingLeft:44}}>{(chapters as Chapter[]).map((chapter) => <li key={chapter.id} style={{padding:"8px 0"}}><span>{chapter.title}</span><span className="tag"> · {chapter.state}</span></li>)}</ol> : <div className="card"><p className="muted">No chapters yet. Every good story has a first page.</p></div>}<p style={{marginTop:24}}><Link className="pill" href={`/work/${id}`}>Preview reader view ↗</Link></p></section></div></main>;
}
