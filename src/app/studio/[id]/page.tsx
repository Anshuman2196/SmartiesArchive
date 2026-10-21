import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { ActionForm, ActionSubmit, ChapterComposer, ConfirmSubmit, WorkMetadataForm } from "@/components/studio-forms";
import { PublishChecklist } from "@/components/publish-checklist";
import { createClient } from "@/lib/supabase/server";
import { deleteChapter, deleteWork, duplicateChapter, publishChapter, publishWork, reorderChapter, unpublishChapter, unpublishWork } from "@/app/actions";
import type { ChapterFormat } from "@/lib/chapter-content";
import { getPublishChecklist } from "@/lib/publishing-checklist";
import { signRichDocument, signStoryMediaUrl } from "@/lib/story-media";

type Chapter = { id: string; title: string; body: string; format: ChapterFormat; content: unknown; position: number; state: "draft" | "published"; updated_at: string };

const statusCopy: Record<string, { message: string; error?: boolean }> = {
  save_error: { message: "We couldn't save that change. Please try again.", error: true },
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
  chapter_published: { message: "Chapter revision published." },
  chapter_unpublished: { message: "Chapter unpublished and kept as a draft." },
  chapter_deleted: { message: "Chapter deleted. Its saved reading progress was removed." },
  chapter_duplicated: { message: "A draft copy of the chapter was created." },
  reordered: { message: "Chapter order updated." },
  published: { message: "Story published with the saved metadata." },
  unpublished: { message: "Story unpublished. Its content and drafts are preserved." },
  work_deleted: { message: "Story deleted." },
};

export default async function WorkStudioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string; chapter?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
      hasDraft: chapterDrafts.has(chapter.id),
    })),
  });
  const message = query.status ? statusCopy[query.status] : undefined;

  return <main className="shell studio-page">
    <div className="studio-topline"><div><Link href="/studio" className="byline">← Your studio</Link><span className="eyebrow studio-overline">{work.state === "published" ? `Published · ${work.visibility}` : `Draft · ${work.visibility}`}</span></div><div className="studio-top-actions"><Link className="pill" href={`/work/${id}`}>View reader page</Link>{work.state === "published" ? <ActionForm action={unpublishWork}><input type="hidden" name="workId" value={id}/><ConfirmSubmit phrase="Unpublish this story? Readers will no longer be able to open it, but its published content will be kept.">Unpublish story</ConfirmSubmit></ActionForm> : <ActionForm action={publishWork}><input type="hidden" name="workId" value={id}/><ActionSubmit>Publish story</ActionSubmit></ActionForm>}</div></div>
    <header className="studio-head"><span className="eyebrow">Creator studio</span><h1 className="serif">{effectiveWork.title}</h1><p className="muted">{publishedCount} published · {chapters.length - publishedCount} in draft</p></header>
    {message && <p className={`notice ${message.error ? "auth-error" : ""}`} role={message.error ? "alert" : "status"}>{message.message}</p>}
    <PublishChecklist items={checklist}/>
    {work.state === "published" && workDraft && <div className="revision-callout"><div><span className="eyebrow">Unpublished changes</span><p>Published readers still see the existing story details.</p></div><ActionForm action={publishWork}><input type="hidden" name="workId" value={id}/><ActionSubmit>Publish story changes</ActionSubmit></ActionForm></div>}
    <div className="studio-grid">
      <details className="studio-panel studio-details"><summary className="panel-heading"><span className="eyebrow">Story details</span><span className="serif">Title, cover, tags, visibility</span></summary><WorkMetadataForm work={{ id, ...effectiveWork, expectedUpdatedAt: workDraft?.updated_at ?? work.updated_at }} previewCoverUrl={coverPreview ?? undefined}/>
        <details className="danger-zone"><summary>Delete story</summary><p>Deleting this story removes its chapters, any pending chapter edits, bookmarks, and reading progress.</p><ActionForm action={deleteWork}><input type="hidden" name="workId" value={id}/><ConfirmSubmit phrase="Permanently delete this story and its chapters, bookmarks, and reading progress? This cannot be undone.">Delete story permanently</ConfirmSubmit></ActionForm></details>
      </details>
      <section className="studio-panel chapter-studio"><div className="panel-heading"><span className="eyebrow">Chapter desk</span><h2 className="serif">Build the reading path.</h2></div>
        {selected ? <div className="chapter-editor-panel"><div className="chapter-edit-title"><div><span className="tag">{selected.state === "published" ? selectedDraft ? "Published · draft revision" : "Published snapshot" : "Draft"}</span><h3 className="serif">{selectedDraft?.title ?? selected.title}</h3></div><Link className="text-action" href={`/studio/${id}`}>Close editor</Link></div><ChapterComposer key={selected.id} workId={id} chapterId={selected.id} expectedUpdatedAt={selectedDraft?.updated_at ?? selected.updated_at} title={selectedDraft?.title ?? selected.title} body={selectedDraft?.body ?? selected.body} format={selectedDraft?.format ?? selected.format} content={editorContent} isRevision={selected.state === "published"}/></div> : <details className="new-chapter-details" open={chapters.length === 0}><summary>Add a chapter</summary><ChapterComposer key="new" workId={id}/></details>}
        <div className="managed-chapters"><div className="managed-heading"><h3 className="serif">Your chapters</h3><span>{chapters.length} total</span></div>{chapters.length ? <ol className="managed-list">{chapters.map((chapter, index) => {
          const draft = chapterDrafts.get(chapter.id);
          return <li key={chapter.id}><span className="chapter-index">{String(index + 1).padStart(2, "0")}</span><div className="managed-chapter-main"><Link className="chapter-title" href={`/studio/${id}?chapter=${chapter.id}`}>{draft?.title ?? chapter.title}</Link><span className="chapter-meta">{chapter.state === "published" ? draft ? "Published · has unpublished revision" : "Published" : "Draft"} · {draft?.format ?? chapter.format}</span></div><div className="chapter-row-actions"><Link className="text-action" href={`/work/${id}/chapter/${chapter.id}`}>{chapter.state === "published" ? "Read published version" : "Preview draft"}</Link><details className="chapter-more"><summary aria-label={`More actions for ${chapter.title}`} title="More chapter actions"><MoreHorizontal size={18} aria-hidden="true"/></summary><div className="chapter-more-menu"><ActionForm action={reorderChapter}><input type="hidden" name="workId" value={id}/><input type="hidden" name="chapterId" value={chapter.id}/><input type="hidden" name="direction" value="up"/><ActionSubmit className="text-action" ariaLabel={`Move ${chapter.title} up`}>Move up</ActionSubmit></ActionForm><ActionForm action={reorderChapter}><input type="hidden" name="workId" value={id}/><input type="hidden" name="chapterId" value={chapter.id}/><input type="hidden" name="direction" value="down"/><ActionSubmit className="text-action" ariaLabel={`Move ${chapter.title} down`}>Move down</ActionSubmit></ActionForm>
            {chapter.state === "published" ? draft ? <ActionForm action={publishChapter}><input type="hidden" name="workId" value={id}/><input type="hidden" name="chapterId" value={chapter.id}/><ActionSubmit className="text-action">Publish revision</ActionSubmit></ActionForm> : <ActionForm action={unpublishChapter}><input type="hidden" name="workId" value={id}/><input type="hidden" name="chapterId" value={chapter.id}/><ConfirmSubmit phrase="Unpublish this chapter? It will stay saved as a draft.">Unpublish</ConfirmSubmit></ActionForm> : <ActionForm action={publishChapter}><input type="hidden" name="workId" value={id}/><input type="hidden" name="chapterId" value={chapter.id}/><ActionSubmit className="text-action">Publish</ActionSubmit></ActionForm>}
            <ActionForm action={duplicateChapter}><input type="hidden" name="workId" value={id}/><input type="hidden" name="chapterId" value={chapter.id}/><ActionSubmit className="text-action">Duplicate</ActionSubmit></ActionForm><ActionForm action={deleteChapter}><input type="hidden" name="workId" value={id}/><input type="hidden" name="chapterId" value={chapter.id}/><ConfirmSubmit phrase="Permanently delete this chapter and any progress saved at this chapter?">Delete</ConfirmSubmit></ActionForm></div></details></div></li>;
        })}</ol> : <div className="empty-studio"><span className="eyebrow">A blank first page</span><p>Your new chapter starts with a draft. Publish it when it&apos;s ready.</p></div>}</div>
      </section>
    </div>
  </main>;
}
