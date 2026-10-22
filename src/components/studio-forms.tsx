"use client";

import { useEffect, useState, type FormEventHandler, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useFormStatus } from "react-dom";
import { createChapter, saveChapter, saveWorkMetadata } from "@/app/actions";
import { uploadStoryMediaFile } from "@/lib/client-story-upload";
import Image from "next/image";
import type { ChapterFormat } from "@/lib/chapter-content";
import { legacyTextToRichDocument, type RichDocument } from "@/lib/rich-document";
import { MangaPanelPicker } from "@/components/manga-panel-picker";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type ServerFormAction = (formData: FormData) => void | Promise<void>;
type MixedBlock = { type: "prose" | "image" | "chat"; text: string; url?: string; alt?: string };
const RichChapterEditor = dynamic(() => import("@/components/rich-chapter-editor").then((module) => module.RichChapterEditor), {
  loading: () => <p className="editor-loading" role="status">Preparing the chapter editor…</p>,
});

export function ActionSubmit({ children, className = "pill primary", ariaLabel, pendingLabel = "Saving…" }: { children: ReactNode; className?: string; ariaLabel?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending} aria-label={ariaLabel}>{pending ? pendingLabel : children}</button>;
}

export function ActionForm({ action, children, className }: { action: ServerFormAction; children: ReactNode; className?: string }) {
  return <form action={action} className={className}>{children}</form>;
}

function ManagedForm({ action, children, className, onSubmit }: { action: ServerFormAction; children: ReactNode; className?: string; onSubmit?: FormEventHandler<HTMLFormElement> }) {
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
  return <form className={className} action={submit} onSubmit={onSubmit} onChange={() => setDirty(true)} onReset={() => setDirty(false)}>{children}{dirty && <span className="unsaved-indicator" role="status">Unsaved changes</span>}</form>;
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
  comic: "Upload and order manga page images, then add optional captions.",
  chat: "Add one message per line in Speaker: message format.",
  mixed: "Build a chapter from prose, images, and chat blocks. Add blocks in the order readers should see them.",
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
  const raw = content as { type?: string; text?: string; url?: string; document?: RichDocument; blocks?: Array<{ type: string; text?: string; url?: string; alt?: string; messages?: Array<{ speaker: string; text: string }> }> } | undefined;
  const [formatError, setFormatError] = useState("");
  const [mixedBlocks, setMixedBlocks] = useState<MixedBlock[]>(() => raw?.type === "mixed" ? (raw.blocks ?? []).map((block) => ({ type: block.type as MixedBlock["type"], text: block.type === "chat" ? (block.messages ?? []).map((message) => `${message.speaker}: ${message.text}`).join("\n") : block.text ?? "", url: block.url, alt: block.alt })) : [{ type: "prose", text: "" }]);
  const mixedPayload = mixedBlocks.map((block) => block.type === "prose" ? { type: "prose", text: block.text } : block.type === "image" ? { type: "image", url: block.url ?? "", alt: block.alt ?? "" } : { type: "chat", messages: block.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => { const separator = line.indexOf(":"); return { speaker: line.slice(0, separator).trim(), text: line.slice(separator + 1).trim() }; }) });
  const validateSpecialFormat: FormEventHandler<HTMLFormElement> = (event) => {
    setFormatError("");
    if (selectedFormat === "chat") {
      const source = new FormData(event.currentTarget).get("content");
      const badLine = typeof source === "string" ? source.split(/\r?\n/).findIndex((line) => { if (!line.trim()) return false; const separator = line.indexOf(":"); return separator < 1 || !line.slice(0, separator).trim() || !line.slice(separator + 1).trim() || line.slice(0, separator).trim().length > 60 || line.slice(separator + 1).trim().length > 2000; }) : -1;
      if (badLine >= 0) { event.preventDefault(); setFormatError(`Add a speaker name and colon to line ${badLine + 1}, for example “Mira: hello”. Your text is still here.`); }
    }
    if (selectedFormat === "mixed") {
      const invalid = mixedBlocks.findIndex((block) => block.type === "chat" ? block.text.split(/\r?\n/).some((line) => { if (!line.trim()) return false; const separator = line.indexOf(":"); return separator < 1 || !line.slice(0, separator).trim() || !line.slice(separator + 1).trim(); }) : block.type === "prose" ? !block.text.trim() : (() => { try { return new URL(block.url ?? "").protocol !== "https:"; } catch { return true; } })());
      if (!mixedBlocks.length || invalid >= 0) { event.preventDefault(); setFormatError(invalid >= 0 ? `Check the content in block ${invalid + 1}. Use non-empty prose, HTTPS image links, and chat lines in Speaker: message format. Your writing is still here.` : "Add at least one content block before saving."); }
    }
  };
  const initialDocument = raw?.type === "rich" && raw.document?.type === "doc" ? raw.document : legacyTextToRichDocument(raw?.type === "prose" && typeof raw.text === "string" ? raw.text : body ?? "");
  return <div className="chapter-composer">
    <FieldGroup><Field><FieldLabel htmlFor={chapterId ? "edit-chapter-format" : "new-chapter-format"}>Chapter format</FieldLabel><NativeSelect id={chapterId ? "edit-chapter-format" : "new-chapter-format"} value={selectedFormat} disabled={!!chapterId} onChange={(event) => setSelectedFormat(event.target.value as ChapterFormat)}>{Object.keys(formatHelp).map((name) => <NativeSelectOption key={name} value={name}>{name === "image" ? "Single image" : name === "comic" ? "Manga / comic" : name === "chat" ? "Chat fiction" : name[0].toUpperCase() + name.slice(1)}</NativeSelectOption>)}</NativeSelect><FieldDescription>{formatHelp[selectedFormat]}{chapterId ? " Existing chapter format is preserved." : ""}</FieldDescription></Field></FieldGroup>
    {selectedFormat === "prose" ? <><RichChapterEditor key={chapterId ?? "new"} workId={workId} initialDocument={initialDocument} initialTitle={title ?? ""} initialChapterId={chapterId} initialUpdatedAt={expectedUpdatedAt}/>{isRevision && <p className="notice">Published readers keep the previous snapshot until you publish this revision.</p>}</> : <ManagedForm action={action} className="studio-edit-form" onSubmit={validateSpecialFormat}>
      <input type="hidden" name="workId" value={workId}/>{chapterId && <><input type="hidden" name="chapterId" value={chapterId}/><input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt}/></>}<input type="hidden" name="format" value={selectedFormat}/>
      <FieldGroup>
        <Field><FieldLabel htmlFor={chapterId ? "edit-chapter-title" : "new-chapter-title"}>Chapter title</FieldLabel><Input id={chapterId ? "edit-chapter-title" : "new-chapter-title"} name="title" defaultValue={title} maxLength={120} required/></Field>
        {selectedFormat === "image" && <Field><FieldLabel htmlFor="media-alt">Image description</FieldLabel><Input id="media-alt" name="mediaAlt" defaultValue={mediaAlt} maxLength={300}/></Field>}
        {selectedFormat === "pdf" ? <PdfAssetPicker workId={workId} initialValue={raw?.type === "pdf" && typeof raw.url === "string" ? raw.url : body ?? ""}/> : selectedFormat === "comic" ? <MangaPanelPicker workId={workId} initialValue={body ?? ""}/> : selectedFormat === "mixed" ? <div className="mixed-block-builder"><input type="hidden" name="content" value={JSON.stringify(mixedPayload)}/>{mixedBlocks.map((block, index) => <section className="mixed-block-card" key={index}><div><strong>Block {index + 1}</strong><NativeSelect aria-label={`Block ${index + 1} type`} value={block.type} onChange={(event) => setMixedBlocks((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as MixedBlock["type"], text: "" } : item))}><NativeSelectOption value="prose">Prose</NativeSelectOption><NativeSelectOption value="image">Image</NativeSelectOption><NativeSelectOption value="chat">Chat</NativeSelectOption></NativeSelect><button type="button" className="text-action" onClick={() => setMixedBlocks((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove block ${index + 1}`}>Remove</button></div>{block.type === "image" ? <><Input aria-label={`Image URL for block ${index + 1}`} type="url" placeholder="https://…" value={block.url ?? ""} onChange={(event) => setMixedBlocks((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))}/><Input aria-label={`Image description for block ${index + 1}`} placeholder="Image description" value={block.alt ?? ""} onChange={(event) => setMixedBlocks((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, alt: event.target.value } : item))}/></> : <Textarea aria-label={block.type === "chat" ? `Chat messages for block ${index + 1}` : `Prose for block ${index + 1}`} placeholder={block.type === "chat" ? "Speaker: message" : "Write this section…"} value={block.text} onChange={(event) => setMixedBlocks((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))}/>}</section>)}<button type="button" className="pill" onClick={() => setMixedBlocks((items) => [...items, { type: "prose", text: "" }])}>Add content block</button></div> : <Field><FieldLabel htmlFor={chapterId ? "edit-chapter-content" : "new-chapter-content"}>Chapter content</FieldLabel><Textarea id={chapterId ? "edit-chapter-content" : "new-chapter-content"} name="content" defaultValue={body} required maxLength={100000} className="chapter-source" placeholder="Add chapter content…"/></Field>}
      </FieldGroup>
      {formatError && <p className="notice auth-error" role="alert">{formatError}</p>}
      {isRevision && <p className="notice">Published readers keep the previous snapshot until you publish this revision.</p>}
      <ActionSubmit>{chapterId ? isRevision ? "Save revision draft" : "Save chapter draft" : "Create chapter draft"}</ActionSubmit>
    </ManagedForm>}
  </div>;
}
