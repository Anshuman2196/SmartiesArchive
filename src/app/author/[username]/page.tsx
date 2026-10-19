import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AuthorPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("id,username,display_name,bio,created_at").eq("username", username).maybeSingle();
  if (!profile) notFound();
  const { data: works } = await supabase.from("works").select("id,title,summary,created_at").eq("author_id", profile.id).eq("visibility", "public").eq("state", "published").order("created_at", { ascending: false });
  return <main className="shell section"><span className="eyebrow">Writer in the archive</span><h1 className="serif" style={{fontSize:52,fontWeight:400}}>{profile.display_name}</h1><p className="muted">@{profile.username}</p>{profile.bio && <p className="muted">{profile.bio}</p>}<hr style={{borderColor:"var(--line)",margin:"36px 0"}}/><h2 className="serif" style={{fontWeight:400}}>Stories</h2><div className="cards">{(works ?? []).map((work) => <article className="card" key={work.id}><Link href={`/work/${work.id}`}><h3>{work.title}</h3></Link><p>{work.summary}</p></article>)}</div>{!works?.length && <p className="muted">No public stories here yet.</p>}</main>;
}
