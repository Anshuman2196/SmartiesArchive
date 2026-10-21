"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { createChapter, createWorkRecord, saveChapter, saveWorkMetadata, setWorkCover } from "@/app/actions";
import { uploadStoryMediaFile } from "@/lib/client-story-upload";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { ChapterFormat } from "@/lib/chapter-content";
import { legacyTextToRichDocument, type RichDocument } from "@/lib/rich-document";
import { RichChapterEditor } from "@/components/rich-chapter-editor";
import { MangaPanelPicker } from "@/components/manga-panel-picker";

type ServerFormAction = (formData: FormData) => void | Promise<void>;

export function ActionSubmit({ children, className = "pill primary", ariaLabel }: { children: ReactNode; className?: string; ariaLabel?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending} aria-label={ariaLabel}>{pending ? "Saving…" : children}</button>;
}

export function ActionForm({ action, children, className }: { action: ServerFormAction; children: ReactNode; className?: string }) {
  return <form action={action} className={className}>{children}</form>;
}

function ManagedForm({ action, children, className }: { action: ServerFormAction; children: ReactNode; className?: string }) {
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty && !pending) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);
  const submit: ServerFormAction = async (data) => {
    setPending(true);
    try { await action(data); }
    finally { setDirty(false); setPending(false); }
  };
  return <form className={className} action={submit} onChange={() => setDirty(true)} onReset={() => setDirty(false)}>{children}{dirty && <span className="unsaved-indicator" role="status">Unsaved changes</span>}</form>;
}

export function ConfirmSubmit({ children, phrase }: { children: ReactNode; phrase: string }) {
  const ask = (event: React.MouseEvent<HTMLButtonElement>) => { if (!window.confirm(phrase)) event.preventDefault(); };
  return <button type="submit" className="danger-button" onClick={ask}>{children}</button>;
}

type EditableWork = { id: string; title: string; summary: string; visibility: string; cover_url: string; tags: string[]; content_warnings: string[]; expectedUpdatedAt: string };

function CoverAssetPicker({ workId, initialValue, initialPreview }: { workId: string; initialValue: string; initialPreview?: string }) {
  const [value, setValue] = useState(initialValue);
  const [preview, setPreview] = useState(initialPreview ?? (initialValue.startsWith("https://") ? initialValue : ""));
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const choose = async (file?: File) => {
    if (!file) return;
    if (!(file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp" || file.type === "image/gif") || file.size > 8 * 1024 * 1024) { setStatus("Choose a JPEG, PNG, WebP, or GIF image under 8 MB."); return; }
    setBusy(true); setStatus("Preparing secure upload…");
    const result = await uploadStoryMediaFile(workId, file, (percent) => setStatus(`Uploading cover… ${percent}%`));
    setBusy(false);
    if (!result.ok || !result.src || !result.previewSrc) { setStatus(result.message ?? "Cover upload failed."); return; }
    setValue(result.src); setPreview(result.previewSrc); setStatus("Cover uploaded. Save work details to apply it.");
  };
  return <div className="cover-asset-picker"><input type="hidden" name="coverUrl" value={value}/>{preview ? <Image className="cover-upload-preview" src={preview} width={600} height={900} unoptimized alt="Selected story cover preview"/> : <div className="cover-upload-empty">Cover preview</div>}<div className="cover-picker-actions"><label className="pill upload-image-button">{busy ? "Uploading…" : value ? "Replace cover" : "Select cover image"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={(event) => void choose(event.target.files?.[0])}/></label><button type="button" className="text-action" onClick={() => { setValue(""); setPreview(""); setStatus("Cover removed. Save work details to apply."); }}>Remove cover</button></div><label className="field-hint" htmlFor="edit-work-cover-url">Or use an HTTPS image URL</label><input id="edit-work-cover-url" type="url" inputMode="url" placeholder="https://…" value={value.startsWith("https://") ? value : ""} onChange={(event) => { setValue(event.target.value); setPreview(event.target.value); }}/><p className="field-hint">JPEG, PNG, WebP, or GIF up to 8 MB. Existing cover stays in place until you save.</p>{status && <p role="status" className="field-hint">{status}</p>}</div>;
}

export function NewWorkCoverInput({ file, onFile }: { file?: File; onFile: (file?: File) => void }) {
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { if (!file) { setPreview(""); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  return <div className="cover-asset-picker"><label htmlFor="new-work-cover">Cover image <span className="field-hint">Optional · JPEG, PNG, WebP, or GIF up to 8 MB</span></label><input id="new-work-cover" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const selected = event.target.files?.[0]; setError(""); if (!selected) return; if (!selected.type.startsWith("image/") || selected.size > 8 * 1024 * 1024) { setError("Choose a supported image smaller than 8 MB."); event.target.value = ""; onFile(undefined); return; } onFile(selected); }}/>{preview && <Image className="cover-upload-preview" src={preview} width={600} height={900} unoptimized alt="Selected story cover preview"/>}{file && <button type="button" className="text-action" onClick={() => onFile(undefined)}>Remove cover</button>}{error && <p role="alert" className="field-error">{error}</p>}</div>;
}

export function CreateWorkForm() {
  const router = useRouter();
  const [file, setFile] = useState<File>();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (pending) return;
    setPending(true); setStatus("Creating your story…");
    const result = await createWorkRecord(new FormData(event.currentTarget));
    if (!result.ok || !result.workId) { setPending(false); setStatus(result.message ?? "The story could not be created."); return; }
    if (file) {
      const uploaded = await uploadStoryMediaFile(result.workId, file, setProgress);
      if (!uploaded.ok || !uploaded.src) { setPending(false); router.push(`/studio/${result.workId}?status=cover_upload_error`); return; }
      const saved = await setWorkCover(result.workId, uploaded.src);
      if (!saved.ok) { setPending(false); router.push(`/studio/${result.workId}?status=cover_upload_error`); return; }
    }
    router.push(`/studio/${result.workId}`); router.refresh();
  };
  return <form onSubmit={submit}>
    <div className="field"><label htmlFor="title">Story title</label><input id="title" name="title" required maxLength={120} autoComplete="off"/></div>
    <p className="field-hint">Start privately. Add chapters, a cover, and publishing details when you’re ready.</p>
    <details className="create-work-options"><summary>More story details</summary>
      <div className="field"><label htmlFor="summary">A short introduction</label><textarea id="summary" name="summary" maxLength={2000}/></div>
      <div className="field"><label htmlFor="visibility">Who can read it?</label><select id="visibility" name="visibility"><option value="private">Private — only me</option><option value="unlisted">Unlisted — anyone with the link</option><option value="public">Public — listed in the library</option></select></div>
      <div className="field"><NewWorkCoverInput file={file} onFile={setFile}/></div>
    </details>
    {status && <p role="status" aria-live="polite" className="field-hint">{file && pending ? `${status} ${progress}%` : status}</p>}
    <button className="pill primary" type="submit" disabled={pending}>{pending ? "Creating…" : "Create story"}</button>
  </form>;
}

export function WorkMetadataForm({ work, previewCoverUrl }: { work: EditableWork; previewCoverUrl?: string }) {
  return <ManagedForm action={saveWorkMetadata} className="studio-edit-form">
    <input type="hidden" name="workId" value={work.id}/><input type="hidden" name="expectedUpdatedAt" value={work.expectedUpdatedAt}/>
    <div className="field"><label htmlFor="edit-work-title">Title</label><input id="edit-work-title" name="title" defaultValue={work.title} required maxLength={120}/></div>
    <div className="field"><label htmlFor="edit-work-summary">Synopsis</label><textarea id="edit-work-summary" name="summary" defaultValue={work.summary} maxLength={2000}/></div>
    <div className="field"><span className="field-label">Cover image</span><CoverAssetPicker workId={work.id} initialValue={work.cover_url} initialPreview={previewCoverUrl}/></div>
    <div className="field"><label htmlFor="edit-work-tags">Tags</label><input id="edit-work-tags" name="tags" defaultValue={work.tags.join(", ")} placeholder="fantasy, found family"/><span className="field-hint">Separate up to 20 tags with commas.</span></div>
    <div className="field"><label htmlFor="edit-work-warnings">Content warnings</label><input id="edit-work-warnings" name="contentWarnings" defaultValue={work.content_warnings.join(", ")} placeholder="violence, grief"/><span className="field-hint">Separate up to 20 notes with commas.</span></div>
    <div className="field"><label htmlFor="edit-work-visibility">Visibility</label><select id="edit-work-visibility" name="visibility" defaultValue={work.visibility}><option value="public">Public — listed in library</option><option value="unlisted">Unlisted — direct link</option><option value="private">Private — only you</option></select></div>
    <ActionSubmit>Save work details</ActionSubmit>
  </ManagedForm>;
}

const formatHelp: Record<ChapterFormat, string> = {
  prose: "Rich text with headings, literary styles, images, and formatting.",
  image: "Paste one HTTPS image URL. Add descriptive alt text below.",
  comic: "Add one HTTPS image URL per line. Optionally add | and a panel caption.",
  chat: "Add one message per line in Speaker: message format.",
  mixed: 'Paste a JSON array of blocks, for example: [{"type":"prose","text":"..."},{"type":"image","url":"https://…","alt":"…"}].',
  pdf: "Upload one PDF manga file. PDFs stay private and are rendered in the custom reader.",
};

function PdfAssetPicker({ workId, initialValue }: { workId: string; initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const choose = async (file?: File) => {
    if (!file) return;
    setBusy(true); setStatus("Preparing secure PDF upload…");
    const result = await uploadStoryMediaFile(workId, file, (percent) => setStatus(`Uploading PDF… ${percent}%`));
    setBusy(false);
    if (!result.ok || !result.src || !result.previewSrc) { setStatus(result.message ?? "PDF upload failed."); return; }
    setValue(result.src); setStatus("PDF uploaded. Save the chapter to apply it.");
  };
  return <div className="pdf-asset-picker">
    <input type="hidden" name="content" value={value} required/>
    {value && <a className="field-hint" href={value.startsWith("https://") ? value : undefined} target="_blank" rel="noreferrer">PDF selected · replace if needed</a>}
    <label className="pill upload-image-button">{busy ? "Uploading…" : value ? "Replace PDF" : "Select PDF"}<input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(event) => void choose(event.target.files?.[0])}/></label>
    <p className="field-hint">PDF files only, up to 50 MB. The reader renders pages privately with PDF.js.</p>
    {status && <p role="status" className="field-hint">{status}</p>}
  </div>;
}

export function ChapterComposer({ workId, chapterId, expectedUpdatedAt, title, body, format, mediaAlt, content, isRevision }: { workId: string; chapterId?: string; expectedUpdatedAt?: string; title?: string; body?: string; format?: ChapterFormat; mediaAlt?: string; content?: unknown; isRevision?: boolean }) {
  const [selectedFormat, setSelectedFormat] = useState<ChapterFormat>(format ?? "prose");
  const action = chapterId ? saveChapter : createChapter;
  const raw = content as { type?: string; text?: string; url?: string; document?: RichDocument } | undefined;
  const initialDocument = raw?.type === "rich" && raw.document?.type === "doc" ? raw.document : legacyTextToRichDocument(raw?.type === "prose" && typeof raw.text === "string" ? raw.text : body ?? "");
  return <div className="chapter-composer">
    <div className="field"><label htmlFor={chapterId ? "edit-chapter-format" : "new-chapter-format"}>Chapter format</label><select id={chapterId ? "edit-chapter-format" : "new-chapter-format"} value={selectedFormat} disabled={!!chapterId} onChange={(event) => setSelectedFormat(event.target.value as ChapterFormat)}>{Object.keys(formatHelp).map((name) => <option key={name} value={name}>{name === "image" ? "Single image" : name === "comic" ? "Manga / comic" : name === "chat" ? "Chat fiction" : name[0].toUpperCase() + name.slice(1)}</option>)}</select><span className="field-hint">{formatHelp[selectedFormat]}{chapterId ? " Existing chapter format is preserved." : ""}</span></div>
    {selectedFormat === "prose" ? <><RichChapterEditor key={chapterId ?? "new"} workId={workId} initialDocument={initialDocument} initialTitle={title ?? ""} initialChapterId={chapterId} initialUpdatedAt={expectedUpdatedAt}/>{isRevision && <p className="notice">Published readers keep the previous snapshot until you publish this revision.</p>}</> : <ManagedForm action={action} className="studio-edit-form"><input type="hidden" name="workId" value={workId}/>{chapterId && <><input type="hidden" name="chapterId" value={chapterId}/><input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt}/></>}<input type="hidden" name="format" value={selectedFormat}/><div className="field"><label htmlFor={chapterId ? "edit-chapter-title" : "new-chapter-title"}>Chapter title</label><input id={chapterId ? "edit-chapter-title" : "new-chapter-title"} name="title" defaultValue={title} maxLength={120} required/></div>{selectedFormat === "image" && <div className="field"><label htmlFor="media-alt">Image description</label><input id="media-alt" name="mediaAlt" defaultValue={mediaAlt} maxLength={300}/></div>}{selectedFormat === "pdf" ? <PdfAssetPicker workId={workId} initialValue={raw?.type === "pdf" && typeof raw.url === "string" ? raw.url : body ?? ""}/> : selectedFormat === "comic" ? <MangaPanelPicker workId={workId} initialValue={body ?? ""}/> : <div className="field"><label htmlFor={chapterId ? "edit-chapter-content" : "new-chapter-content"}>Chapter content</label><textarea id={chapterId ? "edit-chapter-content" : "new-chapter-content"} name="content" defaultValue={body} required maxLength={100000} className="chapter-source" placeholder="Add chapter content…"/></div>}{isRevision && <p className="notice">Published readers keep the previous snapshot until you publish this revision.</p>}<ActionSubmit>{chapterId ? isRevision ? "Save revision draft" : "Save chapter draft" : "Create chapter draft"}</ActionSubmit></ManagedForm>}
  </div>;
}
