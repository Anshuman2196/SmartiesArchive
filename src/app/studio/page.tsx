import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateWorkForm } from "@/components/create-work-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { deleteWork } from "@/app/actions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Creator Studio" };

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?mode=login&next=%2Fstudio");
  const [{ data: profile }, { data: works }] = await Promise.all([
    supabase.from("profiles").select("username,display_name").eq("id", user.id).single(),
    supabase.from("works").select("id,title,summary,visibility,state,updated_at").eq("author_id", user.id).order("updated_at", { ascending: false }),
  ]);
  return <main id="main-content" tabIndex={-1} className="shell section studio-index-page"><div className="section-head"><div><span className="eyebrow">Creator Studio</span><h1 className="serif studio-welcome">Your studio.</h1><p className="muted">Welcome, {profile?.display_name ?? "writer"}. Pick up a draft or begin a new story.</p>{profile?.username && <Link href={`/author/${profile.username}`} className="byline">View your public profile</Link>}</div><Dialog><DialogTrigger asChild><Button><Plus data-icon="inline-start"/>New story</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Begin a story</DialogTitle><DialogDescription>Give it a title. You can add the rest from your studio.</DialogDescription></DialogHeader><CreateWorkForm/></DialogContent></Dialog></div>
    {status === "save_error" && <p className="notice auth-error" role="alert">We couldn’t save that change. Check your details and try again.</p>}{status === "invalid_work" && <p className="notice auth-error" role="alert">Add a title and check the work details before saving.</p>}{status === "cover_upload_error" && <p className="notice auth-error" role="alert">The story was created, but its cover could not be saved. You can try again in work settings.</p>}{status === "saved" && <p className="notice" role="status">Chapter saved.</p>}{status === "work_deleted" && <p className="notice" role="status">Story deleted.</p>}{status === "delete_failed" && <p className="notice auth-error" role="alert">The draft could not be deleted. Please try again.</p>}{(status === "delete_not_found" || status === "not_found") && <p className="notice auth-error" role="alert">The draft was not deleted. Refresh the page and try again.</p>}
    <section className="studio-index-works"><span className="eyebrow">Your desk</span><h2 className="serif">Stories in progress</h2>{works?.length ? <div className="studio-work-list">{works.map((work) => <div key={work.id} className="studio-work-item"><Link href={`/studio/${work.id}`} className="studio-work-row"><span className="studio-work-status">{work.state} · {work.visibility}</span><h3>{work.title}</h3><p>{work.summary || "Add an introduction from story details."}</p></Link>{work.state === "draft" && <form action={deleteWork} className="studio-work-delete"><input type="hidden" name="workId" value={work.id}/><input type="hidden" name="draftOnly" value="1"/><ConfirmSubmit phrase={`Permanently delete “${work.title}” and its chapters? This cannot be undone.`}>Delete draft</ConfirmSubmit></form>}</div>)}</div> : <div className="studio-index-empty"><p>Your desk is clear. Give your first story a title to begin.</p></div>}</section></main>;
}
