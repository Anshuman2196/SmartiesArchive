import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Work = { id: string; title: string; summary: string; created_at: string; profiles: { username: string; display_name: string } | null };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  let works: Work[] = [];
  let configured = true;
  try {
    const supabase = await createClient();
    let query = supabase.from("works").select("id,title,summary,created_at,profiles(username,display_name)").eq("visibility", "public").eq("state", "published").order("created_at", { ascending: false }).limit(60);
    if (q.trim()) query = query.or(`title.ilike.%${q.replace(/[,%()]/g, " ")}%,summary.ilike.%${q.replace(/[,%()]/g, " ")}%`);
    const { data } = await query;
    works = (data ?? []) as unknown as Work[];
  } catch { configured = false; }
  return <main className="shell section"><div className="section-head"><div><span className="eyebrow">The public shelves</span><h1 className="serif" style={{fontSize:48,fontWeight:400,margin:"10px 0"}}>The library</h1></div><span className="muted">{works.length} {works.length === 1 ? "story" : "stories"}</span></div><form method="get" className="actions" role="search" style={{margin:"0 0 26px"}}><label htmlFor="q" className="muted">Search stories</label><input id="q" name="q" defaultValue={q} placeholder="A title or a feeling…" style={{minWidth:260,background:"var(--panel)",border:"1px solid var(--line)",color:"var(--cream)",padding:12,borderRadius:4}}/><button className="pill" type="submit">Search</button></form>{!configured && <p className="notice">Connect your Supabase project to open the shelves.</p>}{configured && works.length === 0 && <div className="card"><h2 className="serif">A little quiet on these shelves.</h2><p>Published public stories will find their home here. Be the first to add yours.</p><Link href="/auth" className="pill primary">Write the first story</Link></div>}<div className="cards">{works.map((work) => <article className="card" key={work.id}><span className="tag">Story</span><Link href={`/work/${work.id}`}><h3>{work.title}</h3></Link><p>{work.summary || "A new story begins here."}</p><span className="byline">By <Link href={`/author/${work.profiles?.username}`}>{work.profiles?.display_name ?? "A reader"}</Link></span></article>)}</div></main>;
}
