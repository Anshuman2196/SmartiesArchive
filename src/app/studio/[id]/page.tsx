import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createChapter } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

type Chapter = { id: string; title: string; position: number; state: string };

export default async function WorkStudioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  const { id } = await params;
  const { status } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?mode=login&next=${encodeURIComponent(`/studio/${id}`)}`);
  const { data: work } = await supabase.from("works").select("id,title,summary,visibility,state").eq("id", id).eq("author_id", user.id).maybeSingle();
  if (!work) notFound();
  const { data: chapters } = await supabase.from("chapters").select("id,title,position,state").eq("work_id", id).order("position");
  return <main className="shell section"><Link href="/studio" className="byline">← Your desk</Link><div className="studio-head"><span className="eyebrow">{work.visibility} · {work.state}</span><h1 className="serif" style={{fontSize:48,fontWeight:400,margin:"10px 0"}}>{work.title}</h1><p className="muted">{work.summary}</p></div>
    {status === "save_error" && <p role="alert" className="notice auth-error">We couldn’t save that change. Check your details and try again.</p>}{status === "invalid_chapter" && <p role="alert" className="notice auth-error">Add a chapter title and some text before saving.</p>}{status === "saved" && <p role="status" className="notice">Chapter saved.</p>}
    <div className="split"><section className="card"><span className="eyebrow">Add a chapter</span><h2 className="serif">Let it unfold.</h2><form action={createChapter}><input type="hidden" name="workId" value={id}/><div className="field"><label htmlFor="chapter-title">Chapter title</label><input id="chapter-title" name="title" maxLength={120} required/></div><div className="field"><label htmlFor="content">Chapter text</label><textarea id="content" name="content" required maxLength={100000} style={{minHeight:280}} placeholder="Write your story here. Paragraph breaks will be preserved."/></div><div className="field"><label htmlFor="publish">Save as</label><select id="publish" name="publish"><option value="draft">Draft</option><option value="published">Published</option></select></div><button type="submit" className="pill primary">Save chapter</button></form></section>
      <section><span className="eyebrow">Contents</span><h2 className="serif">Chapters</h2>{chapters?.length ? <ol className="card chapter-list">{(chapters as Chapter[]).map((chapter) => <li key={chapter.id}><span>{chapter.title}</span><span className="tag"> · {chapter.state}</span></li>)}</ol> : <div className="card"><p className="muted">No chapters yet. Every good story has a first page.</p></div>}<p className="preview-link"><Link className="pill" href={`/work/${id}`}>Preview reader view →</Link></p></section>
    </div></main>;
}
