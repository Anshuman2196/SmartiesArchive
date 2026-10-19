import Link from "next/link";
import { redirect } from "next/navigation";
import { createWork } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?mode=login&next=%2Fstudio");
  const [{ data: profile }, { data: works }] = await Promise.all([
    supabase.from("profiles").select("username,display_name").eq("id", user.id).single(),
    supabase.from("works").select("id,title,summary,visibility,state,updated_at").eq("author_id", user.id).order("updated_at", { ascending: false }),
  ]);
  return <main className="shell section"><div className="section-head"><div><span className="eyebrow">Creator studio</span><h1 className="serif studio-welcome">Welcome, {profile?.display_name ?? "writer"}.</h1>{profile?.username && <Link href={`/author/${profile.username}`} className="byline">View your public profile →</Link>}</div></div>
    {status === "save_error" && <p className="notice auth-error" role="alert">We couldn’t save that change. Check your details and try again.</p>}{status === "invalid_work" && <p className="notice auth-error" role="alert">Add a title and check the work details before saving.</p>}{status === "saved" && <p className="notice" role="status">Chapter saved.</p>}
    <div className="split"><section className="card"><span className="eyebrow">New work</span><h2 className="serif">Begin with a title.</h2><form action={createWork}><div className="field"><label htmlFor="title">Story title</label><input id="title" name="title" required maxLength={120}/></div><div className="field"><label htmlFor="summary">A short introduction</label><textarea id="summary" name="summary" maxLength={2000}/></div><div className="field"><label htmlFor="visibility">Who can read it?</label><select id="visibility" name="visibility"><option value="private">Private — only me</option><option value="unlisted">Unlisted — anyone with the link</option><option value="public">Public — listed in the library</option></select></div><button className="pill primary" type="submit">Create work</button></form></section>
      <section><span className="eyebrow">Your desk</span><h2 className="serif">Stories in progress</h2>{works?.length ? works.map((work) => <Link key={work.id} href={`/studio/${work.id}`} className="card work-card"><span className="tag">{work.state} · {work.visibility}</span><h3>{work.title}</h3><p>{work.summary || "No introduction yet."}</p></Link>) : <div className="card"><p className="muted">Your desk is clear. Start a story whenever you’re ready.</p></div>}</section>
    </div></main>;
}
