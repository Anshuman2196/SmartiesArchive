"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { createChapter, createWorkRecord, saveChapter, saveWorkMetadata } from "@/app/actions";
import { uploadStoryMediaFile } from "@/lib/client-story-upload";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { ChapterFormat } from "@/lib/chapter-content";
import { legacyTextToRichDocument, type RichDocument } from "@/lib/rich-document";
import { RichChapterEditor } from "@/components/rich-chapter-editor";
import { MangaPanelPicker } from "@/components/manga-panel-picker";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

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

export function CreateWorkForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (pending) return;
    setPending(true); setStatus("Creating your story…");
    const result = await createWorkRecord(new FormData(event.currentTarget));
    if (!result.ok || !result.workId) { setPending(false); setStatus(result.message ?? "The story could not be created."); return; }
    router.push(`/studio/${result.workId}`); router.refresh();
  };
  return <form onSubmit={submit}>
    <input type="hidden" name="summary" value=""/>
    <input type="hidden" name="visibility" value="private"/>
    <FieldGroup><Field><FieldLabel htmlFor="title">Story title</FieldLabel><Input id="title" name="title" required maxLength={120} autoComplete="off" autoFocus/><FieldDescription>Your story starts as a private draft. Add the cover and publishing details later.</FieldDescription></Field></FieldGroup>
    {status && <p role="status" aria-live="polite" className="field-hint">{status}</p>}
    <Button className="studio-dialog-submit" type="submit" disabled={pending}>{pending ? "Creating…" : "Create story"}</Button>
  </form>;
}

export function WorkMetadataForm({ work, previewCoverUrl }: { work: EditableWork; previewCoverUrl?: string }) {
  return <ManagedForm action={saveWorkMetadata} className="studio-edit-form">
    <input type="hidden" name="workId" value={work.id}/><input type="hidden" name="expectedUpdatedAt" value={work.expectedUpdatedAt}/>
    <FieldGroup>
      <Field><FieldLabel htmlFor="edit-work-title">Title</FieldLabel><Input id="edit-work-title" name="title" defaultValue={work.title} required maxLength={120}/></Field>
      <Field><FieldLabel htmlFor="edit-work-summary">Synopsis</FieldLabel><Textarea id="edit-work-summary" name="summary" defaultValue={work.summary} maxLength={2000}/></Field>
      <Field><FieldTitle>Cover image</FieldTitle><CoverAssetPicker workId={work.id} initialValue={work.cover_url} initialPreview={previewCoverUrl}/></Field>
      <Field><FieldLabel htmlFor="edit-work-tags">Tags</FieldLabel><Input id="edit-work-tags" name="tags" defaultValue={work.tags.join(", ")} placeholder="fantasy, found family"/><FieldDescription>Separate up to 20 tags with commas.</FieldDescription></Field>
      <Field><FieldLabel htmlFor="edit-work-warnings">Content warnings</FieldLabel><Input id="edit-work-warnings" name="contentWarnings" defaultValue={work.content_warnings.join(", ")} placeholder="violence, grief"/><FieldDescription>Separate up to 20 notes with commas.</FieldDescription></Field>
      <Field><FieldLabel htmlFor="edit-work-visibility">Visibility</FieldLabel><NativeSelect id="edit-work-visibility" name="visibility" defaultValue={work.visibility}><NativeSelectOption value="public">Public — listed in library</NativeSelectOption><NativeSelectOption value="unlisted">Unlisted — direct link</NativeSelectOption><NativeSelectOption value="private">Private — only you</NativeSelectOption></NativeSelect></Field>
    </FieldGroup>
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
    <FieldGroup><Field><FieldLabel htmlFor={chapterId ? "edit-chapter-format" : "new-chapter-format"}>Chapter format</FieldLabel><NativeSelect id={chapterId ? "edit-chapter-format" : "new-chapter-format"} value={selectedFormat} disabled={!!chapterId} onChange={(event) => setSelectedFormat(event.target.value as ChapterFormat)}>{Object.keys(formatHelp).map((name) => <NativeSelectOption key={name} value={name}>{name === "image" ? "Single image" : name === "comic" ? "Manga / comic" : name === "chat" ? "Chat fiction" : name[0].toUpperCase() + name.slice(1)}</NativeSelectOption>)}</NativeSelect><FieldDescription>{formatHelp[selectedFormat]}{chapterId ? " Existing chapter format is preserved." : ""}</FieldDescription></Field></FieldGroup>
    {selectedFormat === "prose" ? <><RichChapterEditor key={chapterId ?? "new"} workId={workId} initialDocument={initialDocument} initialTitle={title ?? ""} initialChapterId={chapterId} initialUpdatedAt={expectedUpdatedAt}/>{isRevision && <p className="notice">Published readers keep the previous snapshot until you publish this revision.</p>}</> : <ManagedForm action={action} className="studio-edit-form">
      <input type="hidden" name="workId" value={workId}/>{chapterId && <><input type="hidden" name="chapterId" value={chapterId}/><input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt}/></>}<input type="hidden" name="format" value={selectedFormat}/>
      <FieldGroup>
        <Field><FieldLabel htmlFor={chapterId ? "edit-chapter-title" : "new-chapter-title"}>Chapter title</FieldLabel><Input id={chapterId ? "edit-chapter-title" : "new-chapter-title"} name="title" defaultValue={title} maxLength={120} required/></Field>
        {selectedFormat === "image" && <Field><FieldLabel htmlFor="media-alt">Image description</FieldLabel><Input id="media-alt" name="mediaAlt" defaultValue={mediaAlt} maxLength={300}/></Field>}
        {selectedFormat === "pdf" ? <PdfAssetPicker workId={workId} initialValue={raw?.type === "pdf" && typeof raw.url === "string" ? raw.url : body ?? ""}/> : selectedFormat === "comic" ? <MangaPanelPicker workId={workId} initialValue={body ?? ""}/> : <Field><FieldLabel htmlFor={chapterId ? "edit-chapter-content" : "new-chapter-content"}>Chapter content</FieldLabel><Textarea id={chapterId ? "edit-chapter-content" : "new-chapter-content"} name="content" defaultValue={body} required maxLength={100000} className="chapter-source" placeholder="Add chapter content…"/></Field>}
      </FieldGroup>
      {isRevision && <p className="notice">Published readers keep the previous snapshot until you publish this revision.</p>}
      <ActionSubmit>{chapterId ? isRevision ? "Save revision draft" : "Save chapter draft" : "Create chapter draft"}</ActionSubmit>
    </ManagedForm>}
  </div>;
}
