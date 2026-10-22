import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChapterActionsMenu } from "@/components/chapter-actions-menu";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { notFound, redirect } from "next/navigation";
import { ActionForm, ActionSubmit, ChapterComposer, WorkMetadataForm } from "@/components/studio-forms";
import { PublishChecklist } from "@/components/publish-checklist";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { deleteChapter, deleteWork, publishWork, unpublishWork } from "@/app/actions";
import type { ChapterFormat } from "@/lib/chapter-content";
import { chapterFormatLabel } from "@/lib/chapter-format-label";
import { getPublishChecklist } from "@/lib/publishing-checklist";
import { workStatusLabel } from "@/lib/work-visibility";
import { signRichDocument, signStoryMediaUrl } from "@/lib/story-media";
import { DismissibleNotice } from "@/components/dismissible-notice";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: work } = await supabase.from("works").select("title").eq("id", id).maybeSingle();
  return { title: work ? `Writing ${work.title}` : "Creator Studio", robots: { index: false, follow: false } };
}

type Chapter = { id: string; title: string; body: string; format: ChapterFormat; content: unknown; position: number; state: "draft" | "published"; updated_at: string };

const statusCopy: Record<string, { message: string; error?: boolean }> = {
  save_error: { message: "We couldn’t save that change. Please try again.", error: true },
  invalid_chapter: { message: "Check the chapter title and its format-specific content.", error: true },
  invalid_chapter_format: { message: "This chapter's draft formatting could not be verified, so it was not published. Your current published chapter remains unchanged; reopen the draft and correct its formatting before retrying.", error: true },
  conflict: { message: "This story changed in another session. Reload the page before saving again.", error: true },
  not_found: { message: "That story or chapter is no longer available.", error: true },
  delete_failed: { message: "The delete request was rejected. Your story and chapters are still saved; refresh and try again. If it keeps failing, share the safe error code from the server log with support.", error: true },
  delete_not_found: { message: "Nothing was deleted because that item could not be found or is no longer yours to manage. Refresh the page and try again.", error: true },
  no_published_chapters: { message: "Publish at least one chapter before publishing the story.", error: true },
  invalid_work: { message: "Check the story details. Titles and tags must fit the requirements, and cover links must use HTTPS.", error: true },
  cover_upload_error: { message: "The work was created, but its cover image could not be uploaded. You can retry from Story details.", error: true },
  metadata_draft: { message: "Details saved as a private draft. Readers will keep seeing the published version until you publish these changes." },
  metadata_saved: { message: "Story details saved." },
  chapter_created: { message: "Chapter draft created." },
  chapter_saved: { message: "Chapter draft saved." },
  chapter_draft_saved: { message: "Revision draft saved. Readers still see the published chapter." },
  chapter_published: { message: "Chapter published." },
  chapter_unpublished: { message: "Chapter unpublished and kept as a draft." },
  revision_discarded: { message: "Unpublished chapter changes discarded." },
  chapter_deleted: { message: "Chapter deleted. Its saved reading progress was removed." },
  chapter_duplicated: { message: "A draft copy of the chapter was created." },
  reordered: { message: "Chapter order updated." },
  published: { message: "Story is live for readers." },
  unpublished: { message: "Story unpublished. Its content and drafts are preserved." },
  work_deleted: { message: "Story deleted." },
};

export default async function WorkStudioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string; chapter?: string; view?: string; new?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect(`/auth?mode=login&next=${encodeURIComponent(`/studio/${id}`)}`);
  const { data: work } = await supabase.from("works").select("id,title,summary,visibility,state,cover_url,tags,content_warnings,updated_at").eq("id", id).eq("author_id", user.id).maybeSingle();
  if (!work) notFound();
  const [{ data: workDraft }, { data: chaptersData }] = await Promise.all([
    supabase.from("work_drafts").select("title,summary,visibility,cover_url,tags,content_warnings,updated_at").eq("work_id", id).maybeSingle(),
    supabase.from("chapters").select("id,title,body,format,content,position,state,updated_at").eq("work_id", id).order("position"),
  ]);
  const chapters = (chaptersData ?? []) as Chapter[];
  const { data: chapterDraftRows } = await supabase.from("chapter_drafts").select("chapter_id,title,body,format,content,updated_at").eq("work_id", id);
  const chapterDrafts = new Map((chapterDraftRows ?? []).map((draft) => [draft.chapter_id, draft]));
  const selected = query.chapter ? chapters.find((chapter) => chapter.id === query.chapter) : undefined;
  if (query.chapter && !selected) notFound();
  const selectedDraft = selected ? chapterDrafts.get(selected.id) : undefined;
  const effectiveWork = workDraft ?? work;
  const coverPreview = await signStoryMediaUrl(supabase, effectiveWork.cover_url);
  let editorContent = selectedDraft?.content ?? selected?.content;
  if (typeof editorContent === "object" && editorContent !== null && (editorContent as { type?: string }).type === "rich") {
    const rich = editorContent as { type: "rich"; document: unknown };
    editorContent = { ...rich, document: await signRichDocument(rich.document, supabase) };
  }
  const publishedCount = chapters.filter((chapter) => chapter.state === "published").length;
  const checklist = getPublishChecklist({
    coverUrl: effectiveWork.cover_url,
    contentWarnings: effectiveWork.content_warnings,
    chapters: chapters.map((chapter) => ({
      title: chapter.title,
      state: chapter.state,
      body: chapterDrafts.get(chapter.id)?.body ?? chapter.body,
      content: chapterDrafts.get(chapter.id)?.content ?? chapter.content,
      hasDraft: chapterDrafts.has(chapter.id),
    })),
  });
  const message = query.status ? statusCopy[query.status] : undefined;
  const statusParams = new URLSearchParams();
  if (query.chapter) statusParams.set("chapter", query.chapter);
  if (query.view) statusParams.set("view", query.view);
  if (query.new) statusParams.set("new", query.new);
  const statusQuery = statusParams.toString();
  const cleanStatusHref = `/studio/${id}${statusQuery ? `?${statusQuery}` : ""}`;

  return <main id="main-content" tabIndex={-1} className="shell studio-page">
    <Link href="/studio" className="byline studio-back-link"><ArrowLeft size={15} aria-hidden="true"/> Creator Studio</Link>
    <header className="studio-head"><div className="studio-head-copy"><span className="eyebrow studio-overline">{workStatusLabel(work.state, work.visibility)}</span><h1 className="serif">{effectiveWork.title}</h1><p className="muted">{publishedCount} published · {chapters.length - publishedCount} in draft</p></div><div className="studio-top-actions"><Link className="pill" href={`/work/${id}`}>View reader page</Link>{work.state === "published" ? <ActionForm action={unpublishWork}><input type="hidden" name="workId" value={id}/><ConfirmSubmit phrase="Unpublish this story? Readers will no longer be able to open it, but its published content will be kept.">Unpublish story</ConfirmSubmit></ActionForm> : <ActionForm action={publishWork}><input type="hidden" name="workId" value={id}/><ActionSubmit pendingLabel="Publishing…">Publish story</ActionSubmit></ActionForm>}</div></header>
    {message && <DismissibleNotice message={message.message} error={message.error} hrefWithoutStatus={cleanStatusHref}/>}
    <PublishChecklist workId={id} items={checklist}/>
    {work.state === "published" && workDraft && <div className="revision-callout"><div><span className="eyebrow">Unpublished changes</span><p>Published readers still see the existing story details.</p></div><ActionForm action={publishWork}><input type="hidden" name="workId" value={id}/><ActionSubmit>Publish story changes</ActionSubmit></ActionForm></div>}
    <Tabs defaultValue={query.view === "details" ? "details" : "chapters"} className="studio-workspace">
      <TabsList variant="line" aria-label="Studio sections"><TabsTrigger value="chapters">Chapters</TabsTrigger><TabsTrigger value="details">Story details</TabsTrigger></TabsList>
      <TabsContent id="story-details" value="details" forceMount className="studio-details-pane data-[state=inactive]:hidden"><div className="panel-heading"><span className="eyebrow">Story details</span><h2 className="serif">The story readers will find.</h2></div><WorkMetadataForm work={{ id, ...effectiveWork, expectedUpdatedAt: workDraft?.updated_at ?? work.updated_at }} previewCoverUrl={coverPreview ?? undefined}/>
        <section className="danger-zone"><h3>Delete story</h3><p>Deleting this story removes its chapters, pending edits, bookmarks, and reading progress.</p><ActionForm action={deleteWork}><input type="hidden" name="workId" value={id}/><ConfirmSubmit phrase="Permanently delete this story and its chapters, bookmarks, and reading progress? This cannot be undone.">Delete story permanently</ConfirmSubmit></ActionForm></section>
      </TabsContent>
      <TabsContent id="studio-chapters" value="chapters" forceMount className="chapter-studio data-[state=inactive]:hidden"><div className="studio-chapter-heading"><div><span className="eyebrow">Chapter desk</span><h2 className="serif">Build the reading path.</h2></div>{query.new !== "1" && chapters.length > 0 && <Button asChild><Link href={`/studio/${id}?new=1`}><Plus data-icon="inline-start"/>New chapter</Link></Button>}</div>
        <div className="studio-chapter-workspace">
        <aside className="managed-chapters studio-chapter-list" aria-labelledby="studio-chapter-list-title"><div className="managed-heading"><h3 id="studio-chapter-list-title" className="serif">Your chapters</h3><span>{chapters.length} total</span></div>{chapters.length ? <ol className="managed-list">{chapters.map((chapter, index) => {
          const draft = chapterDrafts.get(chapter.id);
          return <li key={chapter.id}><span className="chapter-index">{String(index + 1).padStart(2, "0")}</span><div className="managed-chapter-main"><Link className="chapter-title" href={`/studio/${id}?chapter=${chapter.id}`}>{draft?.title ?? chapter.title}</Link><span className="chapter-meta">{chapter.state === "published" ? draft ? "Published · has unpublished revision" : "Published" : "Draft"} · {chapterFormatLabel(draft?.format ?? chapter.format)}</span></div><div className="chapter-row-actions"><Button variant="ghost" size="sm" asChild><Link href={`/work/${id}/chapter/${chapter.id}${chapter.state === "draft" || draft ? "?preview=draft" : ""}`}>{chapter.state === "published" && !draft ? "Read published" : "Preview draft"}</Link></Button><ChapterActionsMenu workId={id} chapterId={chapter.id} title={draft?.title ?? chapter.title} state={chapter.state} hasDraft={!!draft} index={index} count={chapters.length}/></div></li>;
        })}</ol> : <div className="empty-studio"><span className="eyebrow">A blank first page</span><p>Your new chapter starts with a draft. Publish it when it&apos;s ready.</p></div>}</aside>
        <section className="studio-chapter-editor" aria-label="Chapter editor">
        {selected ? <div className="chapter-editor-panel"><div className="chapter-edit-title"><div><span className="tag">{selected.state === "published" ? selectedDraft ? "Published · draft revision" : "Published snapshot" : "Draft"}</span><h3 className="serif">{selectedDraft?.title ?? selected.title}</h3></div><div className="chapter-edit-links">{(selected.state === "draft" || selectedDraft) && <Button variant="outline" asChild><Link href={`/work/${id}/chapter/${selected.id}?preview=draft`}>Preview saved draft</Link></Button>}{selected.state === "published" && <Button variant="outline" asChild><Link href={`/work/${id}/chapter/${selected.id}`}>Read published</Link></Button>}<Button variant="outline" asChild><Link href={`/studio/${id}`}>Close editor</Link></Button></div></div><ChapterComposer key={selected.id} workId={id} chapterId={selected.id} expectedUpdatedAt={selectedDraft?.updated_at ?? selected.updated_at} title={selectedDraft?.title ?? selected.title} body={selectedDraft?.body ?? selected.body} format={selectedDraft?.format ?? selected.format} content={editorContent} isRevision={selected.state === "published"}/><div className="chapter-editor-danger"><ActionForm action={deleteChapter}><input type="hidden" name="workId" value={id}/><input type="hidden" name="chapterId" value={selected.id}/><ConfirmSubmit phrase="Permanently delete this chapter and any progress saved at this chapter?">Delete chapter</ConfirmSubmit></ActionForm></div></div> : query.new === "1" || chapters.length === 0 ? <div className="chapter-editor-panel"><div className="chapter-edit-title"><h3 className="serif">New chapter</h3>{chapters.length > 0 && <Button variant="outline" asChild><Link href={`/studio/${id}`}>Cancel</Link></Button>}</div><ChapterComposer key="new" workId={id}/></div> : <div className="empty-studio"><p>Select a chapter or start a new one.</p></div>}
        </section></div>
      </TabsContent>
    </Tabs>
  </main>;
}
