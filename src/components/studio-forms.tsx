"use client";

import { useEffect, useRef, useState, type FormEventHandler, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { createChapter, saveChapter, saveWorkMetadata } from "@/app/actions";
import { uploadStoryMediaFile } from "@/lib/client-story-upload";
import { chapterFormatLabel } from "@/lib/chapter-format-label";
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
function chatSourceError(source: string, location: string): string | null {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return `${location} needs at least one message.`;
  if (lines.length > 500) return `${location} can contain up to 500 messages.`;
  const invalidLine = lines.findIndex((line) => {
    const separator = line.indexOf(":");
    const speaker = separator > 0 ? line.slice(0, separator).trim() : "";
    const message = separator > 0 ? line.slice(separator + 1).trim() : "";
    return !speaker || !message || speaker.length > 60 || message.length > 2000;
  });
  return invalidLine < 0 ? null : `${location} line ${invalidLine + 1} needs a speaker (up to 60 characters) and message (up to 2,000 characters).`;
}
function ChatDraftPreview({ source, label = "Chat preview" }: { source: string; label?: string }) {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.indexOf(":");
    return separator > 0 && line.slice(0, separator).trim() && line.slice(separator + 1).trim()
      ? { speaker: line.slice(0, separator).trim(), text: line.slice(separator + 1).trim() }
      : { speaker: "Needs a speaker", text: line };
  });
  return <section className="chapter-composer-preview" aria-label={label}><strong>{label}</strong>{lines.length ? <div className="chat-transcript">{lines.map((line, index) => <div className="chat-line" key={`${index}-${line.speaker}`}><span className="chat-speaker">{line.speaker}</span><p>{line.text}</p></div>)}</div> : <p className="field-hint">Messages will appear here as you write them.</p>}</section>;
}
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
  const router = useRouter();
  const dirtyRef = useRef(false);
  const allowUnloadRef = useRef(false);
  const markDirty = () => { dirtyRef.current = true; setDirty(true); };
  useEffect(() => {
    if (!dirty || pending) return;
    const formUrl = window.location.href;
    const formHistoryState = window.history.state;
    const warn = (event: BeforeUnloadEvent) => { if (dirtyRef.current && !allowUnloadRef.current) { event.preventDefault(); event.returnValue = ""; } };
    const guardLink = (event: MouseEvent) => {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      event.preventDefault();
      event.stopPropagation();
      if (!window.confirm("This form has unsaved changes. Leave without saving?")) return;
      dirtyRef.current = false;
      setDirty(false);
      if (destination.origin === window.location.origin) router.push(`${destination.pathname}${destination.search}${destination.hash}`);
      else { allowUnloadRef.current = true; window.location.assign(destination.href); }
    };
    const guardBack = () => {
      if (!dirtyRef.current) return;
      window.history.pushState(formHistoryState, "", formUrl);
      if (!window.confirm("This form has unsaved changes. Leave without saving?")) return;
      dirtyRef.current = false;
      setDirty(false);
      window.setTimeout(() => window.history.back(), 0);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardLink, true);
    window.addEventListener("popstate", guardBack);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", guardLink, true); window.removeEventListener("popstate", guardBack); };
  }, [dirty, pending, router]);
  const submit: ServerFormAction = async (data) => {
    setPending(true);
    try { await action(data); }
    finally { dirtyRef.current = false; setDirty(false); setPending(false); }
  };
  return <form className={className} action={submit} onSubmit={onSubmit} onChange={markDirty} onClick={(event) => { if (event.target instanceof Element && event.target.closest(".chip-remove")) markDirty(); }} onKeyDown={(event) => { if (event.key === "Backspace" && event.target instanceof HTMLInputElement && event.target.classList.contains("chip-entry") && !event.target.value) markDirty(); }} onReset={() => { dirtyRef.current = false; setDirty(false); }}>{children}{dirty && <span className="unsaved-indicator" role="status">Unsaved changes</span>}</form>;
}

type EditableWork = { id: string; title: string; summary: string; visibility: string; cover_url: string; tags: string[]; content_warnings: string[]; expectedUpdatedAt: string };

function ChipField({ name, label, description, initialValues, placeholder, maxItems, maxLength }: { name: string; label: string; description: string; initialValues: string[]; placeholder: string; maxItems: number; maxLength: number }) {
  const [items, setItems] = useState(() => initialValues.map((item) => item.trim()).filter(Boolean).slice(0, maxItems));
  const [entry, setEntry] = useState("");
  const [message, setMessage] = useState("");
  const add = (raw: string) => {
    const candidates = raw.split(",").map((item) => item.trim()).filter(Boolean);
    if (!candidates.length) return;
    const next = [...items];
    let warning = "";
    for (const candidate of candidates) {
      if (candidate.length > maxLength) { warning = `Each ${label.toLowerCase().replace(/s$/, "")} must be ${maxLength} characters or fewer.`; continue; }
      if (next.some((item) => item.toLowerCase() === candidate.toLowerCase())) continue;
      if (next.length >= maxItems) { warning = `Add up to ${maxItems} ${label.toLowerCase()}.`; break; }
      next.push(candidate);
    }
    setItems(next);
    setMessage(warning);
    setEntry("");
  };
  return <div className="field chip-field">
    <label htmlFor={`${name}-entry`}>{label}</label>
    <input type="hidden" name={name} value={items.join(", ")}/>
    <div className="chip-entry-wrap">
      <div className="chip-list" aria-label={`${label} added`}>
        {items.map((item, index) => <span className="studio-chip" key={`${item}-${index}`}>{item}<button type="button" className="chip-remove" aria-label={`Remove ${item}`} onClick={() => { setItems((values) => values.filter((_, itemIndex) => itemIndex !== index)); setMessage(""); }}>×</button></span>)}
        <input id={`${name}-entry`} className="chip-entry" value={entry} maxLength={maxLength} placeholder={items.length ? "Add another…" : placeholder} aria-describedby={`${name}-description${message ? ` ${name}-message` : ""}`} onChange={(event) => { setEntry(event.target.value); setMessage(""); if (event.target.value.includes(",")) add(event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(entry); } else if (event.key === "Backspace" && !entry && items.length) setItems((values) => values.slice(0, -1)); }} onBlur={() => { if (entry.trim()) add(entry); }}/>
      </div>
    </div>
    <p id={`${name}-description`} className="field-hint">{description} Press Enter or comma after each item. {items.length}/{maxItems} added.</p>
    {message && <p id={`${name}-message`} className="field-error" role="status">{message}</p>}
  </div>;
}

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
    setValue(result.src); setPreview(result.previewSrc); setStatus("Cover uploaded. Save story details to apply it.");
  };
  return <div className="cover-asset-picker"><input type="hidden" name="coverUrl" value={value}/>{preview ? <Image className="cover-upload-preview" src={preview} width={600} height={900} unoptimized alt="Selected story cover preview"/> : <div className="cover-upload-empty">Cover preview</div>}<div className="cover-picker-actions"><label className="pill upload-image-button">{busy ? "Uploading…" : value ? "Replace cover" : "Select cover image"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={(event) => void choose(event.target.files?.[0])}/></label><button type="button" className="text-action" onClick={() => { setValue(""); setPreview(""); setStatus("Cover removed. Save story details to apply."); }}>Remove cover</button></div><label className="field-hint" htmlFor="edit-work-cover-url">Or use an HTTPS image URL</label><input id="edit-work-cover-url" type="url" inputMode="url" placeholder="https://…" value={value.startsWith("https://") ? value : ""} onChange={(event) => { setValue(event.target.value); setPreview(event.target.value); }}/><p className="field-hint">JPEG, PNG, WebP, or GIF up to 8 MB. Existing cover stays in place until you save.</p>{status && <p role="status" className="field-hint">{status}</p>}</div>;
}

export function WorkMetadataForm({ work, previewCoverUrl }: { work: EditableWork; previewCoverUrl?: string }) {
  return <ManagedForm action={saveWorkMetadata} className="studio-edit-form">
    <input type="hidden" name="workId" value={work.id}/><input type="hidden" name="expectedUpdatedAt" value={work.expectedUpdatedAt}/>
    <FieldGroup>
      <Field><FieldLabel htmlFor="edit-work-title">Title</FieldLabel><Input id="edit-work-title" name="title" defaultValue={work.title} required maxLength={120}/></Field>
      <Field><FieldLabel htmlFor="edit-work-summary">Synopsis</FieldLabel><Textarea id="edit-work-summary" name="summary" defaultValue={work.summary} maxLength={2000}/></Field>
      <Field><FieldTitle>Cover image</FieldTitle><CoverAssetPicker workId={work.id} initialValue={work.cover_url} initialPreview={previewCoverUrl}/></Field>
      <ChipField name="tags" label="Tags" initialValues={work.tags} placeholder="fantasy" maxItems={20} maxLength={32} description="Use short, consistent tags to help readers find your story."/>
      <ChipField name="contentWarnings" label="Content warnings" initialValues={work.content_warnings} placeholder="violence" maxItems={20} maxLength={80} description="Add the story-level content warnings readers should know about."/>
      <Field><FieldLabel htmlFor="edit-work-visibility">Visibility</FieldLabel><NativeSelect id="edit-work-visibility" name="visibility" defaultValue={work.visibility}><NativeSelectOption value="public">Public — listed in library</NativeSelectOption><NativeSelectOption value="unlisted">Shared by link — not listed in the library</NativeSelectOption><NativeSelectOption value="private">Private — only you</NativeSelectOption></NativeSelect></Field>
    </FieldGroup>
    <ActionSubmit>Save story details</ActionSubmit>
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
  const [specialText, setSpecialText] = useState(body ?? "");
  const action = chapterId ? saveChapter : createChapter;
  const raw = content as { type?: string; text?: string; url?: string; document?: RichDocument; blocks?: Array<{ type: string; text?: string; url?: string; alt?: string; messages?: Array<{ speaker: string; text: string }> }> } | undefined;
  const [formatError, setFormatError] = useState("");
  const [mixedBlocks, setMixedBlocks] = useState<MixedBlock[]>(() => raw?.type === "mixed" ? (raw.blocks ?? []).map((block) => ({ type: block.type as MixedBlock["type"], text: block.type === "chat" ? (block.messages ?? []).map((message) => `${message.speaker}: ${message.text}`).join("\n") : block.text ?? "", url: block.url, alt: block.alt })) : [{ type: "prose", text: "" }]);
  const mixedPayload = mixedBlocks.map((block) => block.type === "prose" ? { type: "prose", text: block.text } : block.type === "image" ? { type: "image", url: block.url ?? "", alt: block.alt ?? "" } : { type: "chat", messages: block.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => { const separator = line.indexOf(":"); return { speaker: line.slice(0, separator).trim(), text: line.slice(separator + 1).trim() }; }) });
  const validateSpecialFormat: FormEventHandler<HTMLFormElement> = (event) => {
    setFormatError("");
    if (selectedFormat === "chat") {
      const source = new FormData(event.currentTarget).get("content");
      const issue = typeof source === "string" ? chatSourceError(source, "Chat") : "Add at least one chat message.";
      if (issue) { event.preventDefault(); setFormatError(`${issue} Your text is still here.`); }
    }
    if (selectedFormat === "mixed") {
      if (!mixedBlocks.length || mixedBlocks.length > 200) { event.preventDefault(); setFormatError("Add between 1 and 200 content blocks before saving."); return; }
      const invalid = mixedBlocks.findIndex((block) => block.type === "chat" ? !!chatSourceError(block.text, `Chat in block ${mixedBlocks.indexOf(block) + 1}`) : block.type === "prose" ? !block.text.trim() || block.text.length > 100_000 : (() => { try { return new URL(block.url ?? "").protocol !== "https:" || (block.alt ?? "").length > 300; } catch { return true; } })());
      if (invalid >= 0) { event.preventDefault(); setFormatError(`Check the content in block ${invalid + 1}. Use prose under 100,000 characters, HTTPS image links with descriptions under 300 characters, and valid chat lines. Your writing is still here.`); }
    }
    if (selectedFormat === "image") { try { if (new URL(String(new FormData(event.currentTarget).get("content") ?? "")).protocol !== "https:") throw new Error(); } catch { event.preventDefault(); setFormatError("Enter a valid HTTPS image URL before saving. Your writing is still here."); } }
  };
  const initialDocument = raw?.type === "rich" && raw.document?.type === "doc" ? raw.document : legacyTextToRichDocument(raw?.type === "prose" && typeof raw.text === "string" ? raw.text : body ?? "");
  return <div className="chapter-composer">
    <FieldGroup><Field><FieldLabel htmlFor={chapterId ? "edit-chapter-format" : "new-chapter-format"}>Chapter format</FieldLabel><NativeSelect id={chapterId ? "edit-chapter-format" : "new-chapter-format"} value={selectedFormat} disabled={!!chapterId} onChange={(event) => setSelectedFormat(event.target.value as ChapterFormat)}>{Object.keys(formatHelp).map((name) => <NativeSelectOption key={name} value={name}>{chapterFormatLabel(name)}</NativeSelectOption>)}</NativeSelect><FieldDescription>{formatHelp[selectedFormat]}{chapterId ? " Existing chapter format is preserved." : ""}</FieldDescription></Field></FieldGroup>
    {selectedFormat === "prose" ? <><RichChapterEditor key={chapterId ?? "new"} workId={workId} initialDocument={initialDocument} initialTitle={title ?? ""} initialChapterId={chapterId} initialUpdatedAt={expectedUpdatedAt}/>{isRevision && <p className="notice">Published readers keep the previous snapshot until you publish this revision.</p>}</> : <ManagedForm action={action} className="studio-edit-form" onSubmit={validateSpecialFormat}>
      <input type="hidden" name="workId" value={workId}/>{chapterId && <><input type="hidden" name="chapterId" value={chapterId}/><input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt}/></>}<input type="hidden" name="format" value={selectedFormat}/>
      <FieldGroup>
        <Field><FieldLabel htmlFor={chapterId ? "edit-chapter-title" : "new-chapter-title"}>Chapter title</FieldLabel><Input id={chapterId ? "edit-chapter-title" : "new-chapter-title"} name="title" defaultValue={title} maxLength={120} required/></Field>
        {selectedFormat === "image" && <Field><FieldLabel htmlFor="media-alt">Image description</FieldLabel><Input id="media-alt" name="mediaAlt" defaultValue={mediaAlt} maxLength={300}/></Field>}
        {selectedFormat === "pdf" ? <PdfAssetPicker workId={workId} initialValue={raw?.type === "pdf" && typeof raw.url === "string" ? raw.url : body ?? ""}/> : selectedFormat === "comic" ? <MangaPanelPicker workId={workId} initialValue={body ?? ""}/> : selectedFormat === "mixed" ? <><div className="mixed-block-builder"><input type="hidden" name="content" value={JSON.stringify(mixedPayload)}/>{mixedBlocks.map((block, index) => <section className="mixed-block-card" key={index}><div><strong>Block {index + 1}</strong><NativeSelect aria-label={`Block ${index + 1} type`} value={block.type} onChange={(event) => setMixedBlocks((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as MixedBlock["type"], text: "" } : item))}><NativeSelectOption value="prose">Prose</NativeSelectOption><NativeSelectOption value="image">Image</NativeSelectOption><NativeSelectOption value="chat">Chat</NativeSelectOption></NativeSelect><button type="button" className="text-action" onClick={() => setMixedBlocks((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove block ${index + 1}`}>Remove</button></div>{block.type === "image" ? <><Input aria-label={`Image URL for block ${index + 1}`} type="url" maxLength={2048} placeholder="https://…" value={block.url ?? ""} onChange={(event) => setMixedBlocks((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))}/><Input aria-label={`Image description for block ${index + 1}`} maxLength={300} placeholder="Image description" value={block.alt ?? ""} onChange={(event) => setMixedBlocks((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, alt: event.target.value } : item))}/></> : <Textarea aria-label={block.type === "chat" ? `Chat messages for block ${index + 1}` : `Prose for block ${index + 1}`} placeholder={block.type === "chat" ? "Speaker: message" : "Write this section…"} maxLength={block.type === "prose" ? 100000 : 100000} value={block.text} onChange={(event) => setMixedBlocks((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))}/>}</section>)}<button type="button" className="pill" disabled={mixedBlocks.length >= 200} onClick={() => setMixedBlocks((items) => [...items, { type: "prose", text: "" }])}>Add content block</button></div><section className="chapter-composer-preview" aria-label="Mixed chapter preview"><strong>Reader preview</strong>{mixedBlocks.map((block, index) => <section className="mixed-content-preview-block" key={`preview-${index}`}>{block.type === "prose" ? <div className="prose-content">{block.text.split(/\n{2,}/).filter(Boolean).map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}</div> : block.type === "chat" ? <ChatDraftPreview source={block.text} label={`Chat block ${index + 1}`}/> : <figure className="mixed-image-preview"><span>Image block</span>{block.url && <span>Image source entered</span>}<figcaption>{block.alt || "No image description"}</figcaption></figure>}</section>)}</section></> : selectedFormat === "chat" ? <><Field><FieldLabel htmlFor={chapterId ? "edit-chapter-content" : "new-chapter-content"}>Messages</FieldLabel><Textarea id={chapterId ? "edit-chapter-content" : "new-chapter-content"} name="content" value={specialText} onChange={(event) => setSpecialText(event.target.value)} required maxLength={100000} className="chapter-source" placeholder="Mira: Hello there…"/><FieldDescription>Write one message per line in Speaker: message format.</FieldDescription></Field><ChatDraftPreview source={specialText}/></> : selectedFormat === "image" ? <Field><FieldLabel htmlFor={chapterId ? "edit-chapter-content" : "new-chapter-content"}>HTTPS image URL</FieldLabel><Input id={chapterId ? "edit-chapter-content" : "new-chapter-content"} name="content" type="url" inputMode="url" value={specialText} onChange={(event) => setSpecialText(event.target.value)} required maxLength={2048} placeholder="https://example.com/image.jpg"/><FieldDescription>Paste a direct HTTPS image link and add a description above.</FieldDescription></Field> : <Field><FieldLabel htmlFor={chapterId ? "edit-chapter-content" : "new-chapter-content"}>Chapter content</FieldLabel><Textarea id={chapterId ? "edit-chapter-content" : "new-chapter-content"} name="content" value={specialText} onChange={(event) => setSpecialText(event.target.value)} required maxLength={100000} className="chapter-source" placeholder="Add chapter content…"/></Field>}
      </FieldGroup>
      {formatError && <p className="notice auth-error" role="alert">{formatError}</p>}
      {isRevision && <p className="notice">Published readers keep the previous snapshot until you publish this revision.</p>}
      <ActionSubmit>{chapterId ? isRevision ? "Save revision draft" : "Save chapter draft" : "Create chapter draft"}</ActionSubmit>
    </ManagedForm>}
  </div>;
}
