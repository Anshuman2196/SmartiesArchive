import Link from "next/link";
import { StatusToast } from "@/components/status-toast";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { workStatusLabel } from "@/lib/work-visibility";
import { CreateWorkForm } from "@/components/create-work-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { deleteWork } from "@/app/actions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Creator Studio" };

const studioStatus: Record<string, { message: string; error?: boolean }> = {
  save_error: { message: "We couldn’t save that change. Check your details and try again.", error: true },
  invalid_work: { message: "Add a title and check the story details before saving.", error: true },
  cover_upload_error: { message: "The story was created, but its cover could not be saved. You can try again from story details.", error: true },
  saved: { message: "Chapter saved." },
  work_deleted: { message: "Story deleted." },
  delete_failed: { message: "The draft could not be deleted. Please try again.", error: true },
  delete_not_found: { message: "The draft was not deleted. Refresh the page and try again.", error: true },
  not_found: { message: "The draft was not deleted. Refresh the page and try again.", error: true },
};

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth?mode=login&next=%2Fstudio");
  const [{ data: profile }, { data: works }] = await Promise.all([
    supabase.from("profiles").select("username,display_name").eq("id", user.id).single(),
    supabase.from("works").select("id,title,summary,visibility,state,updated_at").eq("author_id", user.id).order("updated_at", { ascending: false }),
  ]);
  return <main id="main-content" tabIndex={-1} className="shell section studio-index-page"><div className="section-head"><div><span className="eyebrow">Creator Studio</span><h1 className="serif studio-welcome">Your Creator Studio.</h1><p className="muted">Welcome, {profile?.display_name ?? "writer"}. Pick up a draft or begin a new story.</p>{profile?.username && <Link href={`/author/${profile.username}`} className="byline">View your public profile</Link>}</div><Dialog><DialogTrigger asChild><Button><Plus data-icon="inline-start"/>New story</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Begin a story</DialogTitle><DialogDescription>Give it a title. You can add the rest in Creator Studio.</DialogDescription></DialogHeader><CreateWorkForm/></DialogContent></Dialog></div>
    {status && studioStatus[status] && <StatusToast message={studioStatus[status].message} error={studioStatus[status].error} hrefWithoutStatus="/studio"/>}
    <section className="studio-index-works"><span className="eyebrow">Your desk</span><h2 className="serif">Stories in progress</h2>{works?.length ? <div className="studio-work-list">{works.map((work) => <div key={work.id} className="studio-work-item"><Link href={`/studio/${work.id}`} className="studio-work-row"><span className="studio-work-status">{workStatusLabel(work.state, work.visibility)}</span><h3>{work.title}</h3><p>{work.summary || "Add an introduction from story details."}</p></Link>{work.state === "draft" && <form action={deleteWork} className="studio-work-delete"><input type="hidden" name="workId" value={work.id}/><input type="hidden" name="draftOnly" value="1"/><ConfirmSubmit className="icon-action is-danger" label="Delete draft story" phrase={`Permanently delete “${work.title}” and its chapters? This cannot be undone.`}><Trash2/></ConfirmSubmit></form>}</div>)}</div> : <div className="studio-index-empty"><p>Your desk is clear. Give your first story a title to begin.</p></div>}</section></main>;
}
