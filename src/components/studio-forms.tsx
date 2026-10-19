"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { createChapter, saveChapter, saveWorkMetadata } from "@/app/actions";
import type { ChapterFormat } from "@/lib/chapter-content";

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

export function WorkMetadataForm({ work }: { work: EditableWork }) {
  return <ManagedForm action={saveWorkMetadata} className="studio-edit-form">
    <input type="hidden" name="workId" value={work.id}/><input type="hidden" name="expectedUpdatedAt" value={work.expectedUpdatedAt}/>
    <div className="field"><label htmlFor="edit-work-title">Title</label><input id="edit-work-title" name="title" defaultValue={work.title} required maxLength={120}/></div>
    <div className="field"><label htmlFor="edit-work-summary">Synopsis</label><textarea id="edit-work-summary" name="summary" defaultValue={work.summary} maxLength={2000}/></div>
    <div className="field"><label htmlFor="edit-work-cover">Cover image URL</label><input id="edit-work-cover" name="coverUrl" type="url" inputMode="url" placeholder="https://…" defaultValue={work.cover_url} maxLength={2048}/><span className="field-hint">Use an HTTPS image URL. Direct file uploads are not configured yet.</span></div>
    <div className="field"><label htmlFor="edit-work-tags">Tags</label><input id="edit-work-tags" name="tags" defaultValue={work.tags.join(", ")} placeholder="fantasy, found family"/><span className="field-hint">Separate up to 20 tags with commas.</span></div>
    <div className="field"><label htmlFor="edit-work-warnings">Content warnings</label><input id="edit-work-warnings" name="contentWarnings" defaultValue={work.content_warnings.join(", ")} placeholder="violence, grief"/><span className="field-hint">Separate up to 20 notes with commas.</span></div>
    <div className="field"><label htmlFor="edit-work-visibility">Visibility</label><select id="edit-work-visibility" name="visibility" defaultValue={work.visibility}><option value="public">Public — listed in library</option><option value="unlisted">Unlisted — direct link</option><option value="private">Private — only you</option></select></div>
    <ActionSubmit>Save work details</ActionSubmit>
  </ManagedForm>;
}

const formatHelp: Record<ChapterFormat, string> = {
  prose: "Write paragraphs as plain text. Paragraph breaks are preserved.",
  image: "Paste one HTTPS image URL. Add descriptive alt text below.",
  comic: "Add one HTTPS image URL per line. Optionally add | and a panel caption.",
  chat: "Add one message per line in Speaker: message format.",
  mixed: 'Paste a JSON array of blocks, for example: [{"type":"prose","text":"..."},{"type":"image","url":"https://…","alt":"…"}].',
};

export function ChapterComposer({ workId, chapterId, expectedUpdatedAt, title, body, format, mediaAlt, isRevision }: { workId: string; chapterId?: string; expectedUpdatedAt?: string; title?: string; body?: string; format?: ChapterFormat; mediaAlt?: string; isRevision?: boolean }) {
  const [selectedFormat, setSelectedFormat] = useState<ChapterFormat>(format ?? "prose");
  const action = chapterId ? saveChapter : createChapter;
  return <ManagedForm action={action} className="studio-edit-form"><input type="hidden" name="workId" value={workId}/>{chapterId && <><input type="hidden" name="chapterId" value={chapterId}/><input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt}/></>}
    <div className="field"><label htmlFor={chapterId ? "edit-chapter-title" : "new-chapter-title"}>Chapter title</label><input id={chapterId ? "edit-chapter-title" : "new-chapter-title"} name="title" defaultValue={title} maxLength={120} required/></div>
    <div className="field"><label htmlFor={chapterId ? "edit-chapter-format" : "new-chapter-format"}>Chapter format</label><select id={chapterId ? "edit-chapter-format" : "new-chapter-format"} name="format" value={selectedFormat} onChange={(event) => setSelectedFormat(event.target.value as ChapterFormat)}>{Object.keys(formatHelp).map((name) => <option key={name} value={name}>{name === "image" ? "Single image" : name === "comic" ? "Manga / comic" : name === "chat" ? "Chat fiction" : name[0].toUpperCase() + name.slice(1)}</option>)}</select><span className="field-hint">{formatHelp[selectedFormat]}</span></div>
    {selectedFormat === "image" && <div className="field"><label htmlFor="media-alt">Image description</label><input id="media-alt" name="mediaAlt" defaultValue={mediaAlt} maxLength={300}/></div>}
    <div className="field"><label htmlFor={chapterId ? "edit-chapter-content" : "new-chapter-content"}>{selectedFormat === "prose" ? "Chapter text" : "Chapter content"}</label><textarea id={chapterId ? "edit-chapter-content" : "new-chapter-content"} name="content" defaultValue={body} required maxLength={100000} className="chapter-source" placeholder="Write or paste the chapter content…"/></div>
    {isRevision && <p className="notice">This published chapter stays unchanged for readers until you publish this revision.</p>}
    <ActionSubmit>{chapterId ? isRevision ? "Save revision draft" : "Save chapter draft" : "Create chapter draft"}</ActionSubmit>
  </ManagedForm>;
}
