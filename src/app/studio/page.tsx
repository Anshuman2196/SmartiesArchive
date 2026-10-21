import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateWorkForm } from "@/components/studio-forms";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?mode=login&next=%2Fstudio");
  const [{ data: profile }, { data: works }] = await Promise.all([
    supabase.from("profiles").select("username,display_name").eq("id", user.id).single(),
    supabase.from("works").select("id,title,summary,visibility,state,updated_at").eq("author_id", user.id).order("updated_at", { ascending: false }),
  ]);
  return <main className="shell section studio-index-page"><div className="section-head"><div><span className="eyebrow">Creator studio</span><h1 className="serif studio-welcome">Your studio.</h1><p className="muted">Welcome, {profile?.display_name ?? "writer"}. Pick up a draft or begin a new story.</p>{profile?.username && <Link href={`/author/${profile.username}`} className="byline">View your public profile</Link>}</div></div>
    {status === "save_error" && <p className="notice auth-error" role="alert">We couldn’t save that change. Check your details and try again.</p>}{status === "invalid_work" && <p className="notice auth-error" role="alert">Add a title and check the work details before saving.</p>}{status === "cover_upload_error" && <p className="notice auth-error" role="alert">The story was created, but its cover could not be saved. You can try again in work settings.</p>}{status === "saved" && <p className="notice" role="status">Chapter saved.</p>}
    <div className="studio-index"><section className="studio-index-works"><span className="eyebrow">Your desk</span><h2 className="serif">Stories in progress</h2>{works?.length ? <div className="studio-work-list">{works.map((work) => <Link key={work.id} href={`/studio/${work.id}`} className="studio-work-row"><span className="studio-work-status">{work.state} · {work.visibility}</span><h3>{work.title}</h3><p>{work.summary || "Add an introduction from story details."}</p></Link>)}</div> : <div className="studio-index-empty"><p>Your desk is clear. Give your first story a title to begin.</p></div>}</section>
      <section className="studio-index-create"><span className="eyebrow">New story</span><h2 className="serif">Begin with a title.</h2><CreateWorkForm/></section>
    </div></main>;
}
