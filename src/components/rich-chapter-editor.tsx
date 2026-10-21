"use client";

import { Node, Mark, Extension, mergeAttributes } from "@tiptap/core";
import Image from "next/image";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import Placeholder from "@tiptap/extension-placeholder";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listWorkMedia, publishChapter, saveRichChapter } from "@/app/actions";
import { uploadStoryMediaFile } from "@/lib/client-story-upload";
import { literaryTreatments, plainTextFromRichDocument, type RichDocument } from "@/lib/rich-document";
import { RichDocumentRenderer } from "@/components/rich-document-renderer";
import { createEditorShortcutExtension, detectShortcutPlatform, editorShortcutDefinitions, formatShortcut, type EditorShortcutCallbacks, type EditorShortcutDefinition, type ShortcutPlatform } from "@/lib/editor-shortcuts";

const imageNode = Node.create({
  name: "imageBlock", group: "block", atom: true, selectable: true, draggable: true,
  addAttributes() { return { src: { default: "" }, previewSrc: { default: null, rendered: false }, alt: { default: "" }, caption: { default: "" }, width: { default: 100 }, align: { default: "center" } }; },
  parseHTML() { return [{ tag: "figure[data-story-image]", getAttrs: (element) => { const figure = element as HTMLElement; const image = figure.querySelector("img"); return { src: figure.dataset.src ?? image?.getAttribute("src") ?? "", alt: figure.dataset.alt ?? image?.getAttribute("alt") ?? "", caption: figure.querySelector("figcaption")?.textContent ?? "", width: Number(figure.dataset.width ?? 100), align: figure.dataset.align ?? "center" }; } }]; },
  renderHTML({ HTMLAttributes, node }) {
    const width = Math.max(15, Math.min(Number(node.attrs.width) || 100, 100));
    const align = ["left", "right", "center"].includes(node.attrs.align) ? node.attrs.align : "center";
    const style = `width:${width}%;margin-left:${align === "right" ? "auto" : align === "center" ? "auto" : "0"};margin-right:${align === "left" ? "auto" : align === "center" ? "auto" : "0"}`;
    return ["figure", mergeAttributes(HTMLAttributes, { "data-story-image": "true", "data-src": node.attrs.src, "data-alt": node.attrs.alt, "data-width": width, "data-align": align, style }), ["img", { src: node.attrs.previewSrc || node.attrs.src, alt: node.attrs.alt }], ...(node.attrs.caption ? [["figcaption", {}, node.attrs.caption]] : [])];
  },
  addNodeView() { return ReactNodeViewRenderer(ImageBlockView); },
});

function ImageBlockView({ node }: { node: { attrs: Record<string, string | number | null> } }) {
  const attrs = node.attrs;
  const source = typeof attrs.previewSrc === "string" ? attrs.previewSrc : typeof attrs.src === "string" && attrs.src.startsWith("https://") ? attrs.src : "";
  return <NodeViewWrapper className="editor-image-node" contentEditable={false}>{source ? <Image src={source} width={1200} height={900} unoptimized alt={String(attrs.alt ?? "")}/> : <span className="editor-image-missing">Image preview unavailable</span>}{attrs.caption ? <small>{String(attrs.caption)}</small> : null}</NodeViewWrapper>;
}

const spoilerMark = Mark.create({
  name: "spoiler", inclusive: false,
  parseHTML() { return [{ tag: "span[data-spoiler]" }, { tag: "span.spoiler-mark" }]; },
  renderHTML({ HTMLAttributes }) { return ["span", mergeAttributes(HTMLAttributes, { "data-spoiler": "true", class: "spoiler-mark" }), 0]; },
});

const literaryBlock = Node.create({
  name: "literaryBlock", group: "block", content: "block+", defining: true,
  addAttributes() { return { treatment: { default: "narration" } }; },
  parseHTML() { return [{ tag: "section[data-literary]", getAttrs: (element) => ({ treatment: (element as HTMLElement).dataset.literary ?? "narration" }) }]; },
  renderHTML({ HTMLAttributes }) { return ["section", mergeAttributes(HTMLAttributes, { "data-literary": HTMLAttributes.treatment, class: `literary-block literary-${HTMLAttributes.treatment}` }), 0]; },
});

const paragraphIndent = Extension.create({
  name: "paragraphIndent",
  addGlobalAttributes() {
    return [{
      types: ["paragraph", "heading", "literaryBlock"],
      attributes: {
        indent: {
          default: 0,
          parseHTML: (element) => Math.min(4, Math.max(0, Math.round(parseInt((element as HTMLElement).style.marginLeft || "0", 10) / 24))),
          renderHTML: (attributes) => ({ style: attributes.indent ? `margin-left:${Math.min(4, Math.max(0, Number(attributes.indent)) * 24)}px` : undefined }),
        },
      },
    }];
  },
});

const extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }),
  Highlight.configure({ multicolor: true }), TextStyleKit.configure({ lineHeight: false }), TextAlign.configure({ types: ["heading", "paragraph"] }),
  Superscript, Subscript, Placeholder.configure({ placeholder: "Begin the scene…" }), literaryBlock, imageNode, spoilerMark, paragraphIndent,
];

const emojiGroups: Record<string, string[]> = {
  People: ["😀","😊","🥹","😂","😉","😍","🥰","😶‍🌫️","🤔","😢","😭","🤍","🫶","👋","✨"],
  Nature: ["🌙","☀️","🌧️","🌊","🌿","🍂","🌸","🌹","🌲","🕯️","🔥","⭐","🌌"],
  Objects: ["📖","✉️","📝","🔒","💌","⌛","🗝️","🎧","🪞","🧭","💫"],
  Symbols: ["♡","♥","☆","✦","→","…","❝","❞","☾","∞"],
};
const emojiTerms: Record<string, string[]> = {
  People: ["grin happy smile", "smile warm", "pleading cute", "laugh tears", "wink", "heart eyes love", "love hands", "quiet hush", "thinking", "sad", "cry", "hug", "heart hands", "wave hello", "sparkles"],
  Nature: ["moon night", "sun", "rain", "ocean sea", "leaf", "autumn", "flower", "rose", "tree", "candle", "fire", "star", "space galaxy"],
  Objects: ["book reading", "letter mail", "note writing", "lock", "love letter", "hourglass time", "quill writing", "music headphones", "magic", "map", "sparkle"],
  Symbols: ["outline heart", "heart", "star outline", "sparkle", "arrow", "ellipsis pause", "quote open", "quote close", "peace", "infinity"],
};

const treatmentLabel = (value: string) => value[0].toUpperCase() + value.slice(1);

export function RichChapterEditor({ workId, initialDocument, initialTitle, initialChapterId, initialUpdatedAt }: { workId: string; initialDocument: RichDocument; initialTitle: string; initialChapterId?: string; initialUpdatedAt?: string }) {
  const [title, setTitle] = useState(initialTitle);
  const [chapterId, setChapterId] = useState(initialChapterId);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt ?? "");
  const [status, setStatus] = useState("Unsaved draft");
  const [saveError, setSaveError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [documentRevision, setDocumentRevision] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState("text");
  const [selectionActive, setSelectionActive] = useState(false);
  const [preview, setPreview] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [shortcutPlatform, setShortcutPlatform] = useState<ShortcutPlatform>("windows");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [media, setMedia] = useState<Array<{ src: string; previewSrc: string; name: string }>>([]);
  const [mediaError, setMediaError] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [emojiCategory, setEmojiCategory] = useState("People");
  const [activeTreatment, setActiveTreatment] = useState("narration");
  const [imageNotice, setImageNotice] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const documentRef = useRef<RichDocument>(initialDocument);
  const titleRef = useRef(initialTitle);
  const busy = useRef(false);
  const shortcutCallbacksRef = useRef<EditorShortcutCallbacks>({});
  const shortcutHelpCloseRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  const shortcutExtension = useMemo(() => createEditorShortcutExtension(shortcutCallbacksRef), []);
  const editor = useEditor({ extensions: [...extensions, shortcutExtension], content: initialDocument, immediatelyRender: false, onUpdate: ({ editor: instance }) => { documentRef.current = instance.getJSON() as RichDocument; setDocumentRevision((revision) => revision + 1); setDirty(true); setSaveError(""); setStatus("Unsaved changes"); }, onSelectionUpdate: ({ editor: instance }) => setSelectionActive(!instance.state.selection.empty) });
  const save = useCallback(async () => {
    if (!dirty) return true;
    if (busy.current) return false;
    const revision = documentRevision;
    busy.current = true; setStatus("Saving draft…");
    let result: Awaited<ReturnType<typeof saveRichChapter>>;
    try { result = await saveRichChapter(workId, chapterId, titleRef.current, documentRef.current, updatedAt); }
    catch { result = { ok: false, message: "The save could not reach the server. Your writing is still here; retry when connected." }; }
    finally { busy.current = false; }
    if (!result.ok) { setSaveError(result.message ?? "Draft could not be saved. Your writing is still here. Retry when ready."); setStatus("Not saved"); return false; }
    if (result.chapterId) setChapterId(result.chapterId);
    if (result.updatedAt) setUpdatedAt(result.updatedAt);
    setSaveError("");
    if (revision === documentRevision) { setDirty(false); setStatus("Saved"); return true; }
    setStatus("Unsaved changes");
    return false;
  }, [chapterId, dirty, documentRevision, updatedAt, workId]);

  useEffect(() => { if (!dirty) return; if (saveTimer.current) clearTimeout(saveTimer.current); saveTimer.current = setTimeout(() => { void save(); }, 1300); return () => { if (saveTimer.current) clearTimeout(saveTimer.current); }; }, [dirty, documentRevision, save]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  useEffect(() => { setShortcutPlatform(detectShortcutPlatform()); }, []);
  useEffect(() => { if (shortcutHelpOpen) shortcutHelpCloseRef.current?.focus(); }, [shortcutHelpOpen]);

  const wordCount = plainTextFromRichDocument(documentRef.current).trim().split(/\s+/).filter(Boolean).length;
  const activeBlock = editor?.isActive("heading") ? "heading" : editor?.isActive("literaryBlock") ? "literaryBlock" : "paragraph";
  const changeIndent = (amount: number) => { if (!editor) return; const current = Number(editor.getAttributes(activeBlock).indent ?? 0); editor.chain().focus().updateAttributes(activeBlock, { indent: Math.max(0, Math.min(4, current + amount)) }).run(); };
  const applyTreatment = (treatment: string) => { if (!editor) return; if (editor.isActive("literaryBlock")) editor.chain().focus().updateAttributes("literaryBlock", { treatment }).run(); else editor.chain().focus().wrapIn("literaryBlock", { treatment }).run(); };
  const insertMedia = (item: { src: string; previewSrc: string }) => { if (!editor) return; if (editor.isActive("imageBlock")) editor.chain().focus().updateAttributes("imageBlock", item).run(); else editor.chain().focus().insertContent({ type: "imageBlock", attrs: { ...item, alt: "", caption: "", width: 100, align: "center" } }).run(); setMediaOpen(false); setImageNotice("Image inserted or replaced at the cursor."); };
  const upload = async (file?: File) => {
    if (!file) return;
    setImageNotice("Preparing secure upload…");
    const result = await uploadStoryMediaFile(workId, file, (percent) => setImageNotice(`Uploading image… ${percent}%`));
    if (!result.ok || !result.src || !result.previewSrc) { setImageNotice(result.message ?? "Image upload failed."); return; }
    insertMedia({ src: result.src, previewSrc: result.previewSrc });
    setImageNotice("Image uploaded and inserted.");
    if (uploadRef.current) uploadRef.current.value = "";
  };
  const loadMedia = async () => { const list = await listWorkMedia(workId).catch(() => []); setMedia(list); if (!list.length) setMediaError("No uploaded images yet."); };
  const openMedia = () => { setMediaError(""); setMediaOpen((open) => !open); void loadMedia(); };
  const openImagePicker = () => { setSidebarTab("insert"); setSidebarOpen(true); setMediaError(""); setMediaOpen(true); void loadMedia(); };
  const insertEmoji = (emoji: string) => { editor?.chain().focus().insertContent(emoji).run(); setEmojiOpen(false); setEmojiSearch(""); };
  const setLink = () => { if (!editor) return; const href = window.prompt("Enter a website URL or internal story path (for example, /work/…):", editor.getAttributes("link").href ?? "https://"); if (href === null) return; if (!href) editor.chain().focus().unsetLink().run(); else editor.chain().focus().setLink({ href }).run(); };
  const updateImage = (key: "alt" | "caption" | "width" | "align", value: string | number) => editor?.chain().focus().updateAttributes("imageBlock", { [key]: value }).run();

  if (!editor) return <div className="rich-editor-loading" role="status">Preparing your writing space…</div>;
  shortcutCallbacksRef.current = {
    onLink: setLink,
    onIndent: () => changeIndent(1),
    onOutdent: () => changeIndent(-1),
    onInsertImage: openImagePicker,
    onInsertEmoji: () => { setSidebarTab("insert"); setSidebarOpen(true); setEmojiOpen(true); setEmojiSearch(""); },
    onSave: () => { void save(); },
    onTogglePreview: () => setPreview((open) => !open),
    onToggleFocusMode: () => setFocusMode((focused) => !focused),
    onOpenHelp: () => setShortcutHelpOpen(true),
  };
  const selectedImage = editor.isActive("imageBlock");
  const treatmentValue = literaryTreatments.find((item) => item === activeTreatment) ?? "narration";
  const toolbarButton = (label: string, command: () => void, active = false, disabled = false) => <button type="button" className="editor-tool-button" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={command}>{label}</button>;

  const textStyle = editor.getAttributes("textStyle") as Record<string, string | null>;
  const headingValue = editor.isActive("heading", { level: 1 }) ? "h1" : editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : editor.isActive("blockquote") ? "quote" : "p";
  const changeBlock = (value: string) => { if (value === "quote") editor.chain().focus().setBlockquote().run(); else if (value === "p") editor.chain().focus().setParagraph().run(); else editor.chain().focus().toggleHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run(); };
  const setTextColor = (value: string) => editor.chain().focus().setColor(value).run();
  const tabs = [{ id: "text", label: "Text" }, { id: "type", label: "Typography" }, { id: "insert", label: "Insert" }, { id: "literary", label: "Literary" }, { id: "document", label: "Document" }];
  const downloadRecovery = () => {
    const recovery = new Blob([JSON.stringify({ title: titleRef.current, document: editor.getJSON(), savedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(recovery); const link = document.createElement("a"); link.href = url; link.download = "smarties-chapter-recovery.json"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const formattingMore = () => { setSidebarTab("type"); setSidebarOpen(true); };
  const shortcutCategories: EditorShortcutDefinition["category"][] = ["Formatting", "Structure", "Insert", "Editor"];
  const closeShortcutHelp = () => { setShortcutHelpOpen(false); editor.chain().focus().run(); };

  return <section className={`rich-editor ${focusMode ? "is-focused" : ""} ${sidebarOpen ? "sidebar-open" : "sidebar-closed"} ${sidebarOpen ? "" : "format-drawer-closed"}`} aria-label="Chapter writing editor">
    <header className="editor-topbar">
      <div className="editor-topbar-context"><button type="button" className="editor-back-link" aria-label="Return to Creator Studio" onClick={async () => { if (await save()) router.push(`/studio/${workId}`); }}>← <span>Creator Studio</span></button><span aria-hidden="true">/</span><span className="editor-breadcrumb">{title || "Untitled chapter"}</span></div>
      <div className="editor-topbar-actions">
        <span className={`editor-save-status ${saveError ? "has-error" : ""}`} role="status" aria-live="polite"><i aria-hidden="true"/> {saveError ? "Not saved" : status}</span>
        <button type="button" className="editor-top-action editor-format-toggle" aria-label="Open formatting" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)}>Formatting</button>
        <button type="button" className="pill primary editor-save" disabled={!dirty || busy.current} onClick={() => void save()}>{saveError ? "Retry save" : "Save draft"}</button>
        <details className="editor-overflow"><summary aria-label="More chapter actions">•••</summary><div className="editor-overflow-menu">
          {toolbarButton("Undo", () => editor.chain().focus().undo().run(), false, !editor.can().undo())}{toolbarButton("Redo", () => editor.chain().focus().redo().run(), false, !editor.can().redo())}
          <button type="button" className="editor-top-action" aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? "Return to writing" : "Preview chapter"}</button>
          <button type="button" className="editor-top-action" aria-pressed={focusMode} onClick={() => setFocusMode(!focusMode)}>{focusMode ? "Exit focus mode" : "Focus mode"}</button>
          <button type="button" className="editor-top-action" aria-pressed={shortcutHelpOpen} onClick={() => setShortcutHelpOpen(true)}>Keyboard shortcuts</button>
          {chapterId && <form action={publishChapter} className="editor-publish-form"><input type="hidden" name="workId" value={workId}/><input type="hidden" name="chapterId" value={chapterId}/><button className="pill" type="submit" disabled={dirty || !!saveError}>Publish saved draft</button></form>}
          <button type="button" className="editor-top-action" onClick={downloadRecovery}>Download recovery copy</button>
        </div></details>
      </div>
    </header>
    {saveError && <div className="editor-save-error" role="alert"><span>{saveError} Your words and formatting remain in this editor.</span><button type="button" onClick={() => void save()}>Retry save</button><button type="button" onClick={downloadRecovery}>Download recovery copy</button></div>}
    {shortcutHelpOpen && <div className="editor-popover" role="dialog" aria-modal="false" aria-labelledby="editor-shortcut-help-title" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeShortcutHelp(); } }}>
      <div className="editor-popover-head"><strong id="editor-shortcut-help-title">Keyboard shortcuts</strong><button ref={shortcutHelpCloseRef} type="button" onClick={closeShortcutHelp}>Close</button></div>
      <p className="editor-sidebar-help">Shortcuts work while your cursor is in the chapter editor. Formatting controls such as font, size, and color remain in the Formatting panel.</p>
      {shortcutCategories.map((category) => <section key={category} aria-labelledby={`shortcut-category-${category.toLowerCase()}`}>
        <h3 id={`shortcut-category-${category.toLowerCase()}`} className="eyebrow">{category}</h3>
        <div className="editor-sidebar-panel" style={{ gap: 6, paddingTop: 6 }}>
          {editorShortcutDefinitions.filter((definition) => definition.category === category).map((definition) => <div key={definition.id} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}><span><strong>{definition.label}</strong><small style={{ display: "block", color: "var(--muted)" }}>{definition.description}</small></span><kbd>{formatShortcut(definition.shortcut, shortcutPlatform)}</kbd></div>)}
        </div>
      </section>)}
    </div>}
    <div className="editor-workspace">
      <main className="editor-writing-column">
        <div className="rich-editor-heading"><label className="sr-only" htmlFor="rich-chapter-title">Chapter title</label><input id="rich-chapter-title" placeholder="Untitled chapter" value={title} maxLength={120} onChange={(event) => { setTitle(event.target.value); titleRef.current = event.target.value; setDocumentRevision((revision) => revision + 1); setDirty(true); setSaveError(""); setStatus("Unsaved changes"); }}/></div>
        {selectionActive && !preview && <div className="editor-selection-toolbar" role="toolbar" aria-label="Selected text formatting">
          {toolbarButton("Bold", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}{toolbarButton("Italic", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}{toolbarButton("Underline", () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}{toolbarButton("Highlight", () => editor.chain().focus().toggleHighlight({ color: "#d4f36a" }).run(), editor.isActive("highlight"))}
          <label className="sr-only" htmlFor="selection-text-color">Text color</label><input id="selection-text-color" type="color" aria-label="Selected text color" value={textStyle.color ?? "#f1eadb"} onChange={(event) => setTextColor(event.target.value)}/>
          {toolbarButton("Link", setLink, editor.isActive("link"))}{toolbarButton("Spoiler", () => editor.chain().focus().toggleMark("spoiler").run(), editor.isActive("spoiler"))}<button type="button" className="editor-tool-button" onClick={formattingMore} aria-label="More formatting">More</button>
        </div>}
        {preview ? <article className="rich-editor-preview"><RichDocumentRenderer document={editor.getJSON() as RichDocument}/></article> : <div className="rich-editor-canvas"><EditorContent editor={editor}/></div>}
        <footer className="editor-writing-footer"><span>{status}</span><details><summary>Chapter details</summary><span>{wordCount.toLocaleString()} words · {Math.max(1, Math.ceil(wordCount / 220))} min read · private draft</span></details></footer>
      </main>
      <aside className="editor-format-sidebar" aria-label="Formatting controls" aria-hidden={!sidebarOpen} inert={!sidebarOpen}>
        <div className="editor-sidebar-heading"><span className="eyebrow">Format</span><button type="button" className="editor-sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close formatting panel">Close</button></div>
        <div className="editor-sidebar-tabs" role="tablist" aria-label="Formatting sections">{tabs.map((tab) => <button key={tab.id} id={`editor-tab-${tab.id}`} type="button" role="tab" aria-selected={sidebarTab === tab.id} aria-controls="editor-sidebar-panel" onClick={() => setSidebarTab(tab.id)}>{tab.label}</button>)}</div>
        <div id="editor-sidebar-panel" role="tabpanel" aria-labelledby={`editor-tab-${sidebarTab}`} className="editor-sidebar-panel">
          {sidebarTab === "text" && <>
            <label className="editor-control">Paragraph style<select aria-label="Paragraph style" value={headingValue} onChange={(event) => changeBlock(event.target.value)}><option value="p">Paragraph</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="quote">Blockquote</option></select></label>
            <div className="editor-control-group" aria-label="Inline formatting">{toolbarButton("Bold", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}{toolbarButton("Italic", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}{toolbarButton("Underline", () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}{toolbarButton("Strike", () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"))}</div>
            <div className="editor-control-group" aria-label="Spoiler formatting">{toolbarButton("Spoiler", () => editor.chain().focus().toggleMark("spoiler").run(), editor.isActive("spoiler"))}</div>
            <div className="editor-control-group">{toolbarButton("Bulleted list", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}{toolbarButton("Numbered list", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}</div>
          </>}
          {sidebarTab === "type" && <>
            <label className="editor-control">Typeface<select aria-label="Font family" value={textStyle.fontFamily ?? ""} onChange={(event) => event.target.value ? editor.chain().focus().setFontFamily(event.target.value).run() : editor.chain().focus().unsetFontFamily().run()}><option value="">Story default</option><option>Georgia</option><option>Palatino</option><option>Arial</option><option>Verdana</option><option>Courier New</option></select></label>
            <label className="editor-control">Text size<select aria-label="Font size" value={textStyle.fontSize ?? ""} onChange={(event) => event.target.value ? editor.chain().focus().setFontSize(event.target.value).run() : editor.chain().focus().unsetFontSize().run()}><option value="">Story default</option><option value="12px">12 px</option><option value="14px">14 px</option><option value="16px">16 px</option><option value="18px">18 px</option><option value="22px">22 px</option><option value="28px">28 px</option><option value="36px">36 px</option></select></label>
            <label className="editor-control">Text color<input aria-label="Text color" type="color" value={textStyle.color ?? "#f1eadb"} onChange={(event) => setTextColor(event.target.value)}/></label>
            <label className="editor-control">Highlight color<input aria-label="Highlight color" type="color" value={String(editor.getAttributes("highlight").color ?? "#d4f36a")} onChange={(event) => editor.chain().focus().toggleHighlight({ color: event.target.value }).run()}/></label>
            <div className="editor-control-group" aria-label="Paragraph alignment">{toolbarButton("Align left", () => editor.chain().focus().setTextAlign("left").run(), editor.getAttributes(activeBlock).textAlign === "left")}{toolbarButton("Align center", () => editor.chain().focus().setTextAlign("center").run(), editor.getAttributes(activeBlock).textAlign === "center")}{toolbarButton("Align right", () => editor.chain().focus().setTextAlign("right").run(), editor.getAttributes(activeBlock).textAlign === "right")}{toolbarButton("Justify", () => editor.chain().focus().setTextAlign("justify").run(), editor.getAttributes(activeBlock).textAlign === "justify")}</div>
            <div className="editor-control-group">{toolbarButton("Indent", () => changeIndent(1))}{toolbarButton("Outdent", () => changeIndent(-1))}{toolbarButton("Superscript", () => editor.chain().focus().toggleSuperscript().run(), editor.isActive("superscript"))}{toolbarButton("Subscript", () => editor.chain().focus().toggleSubscript().run(), editor.isActive("subscript"))}</div>
          </>}
          {sidebarTab === "insert" && <>
            <div className="editor-control-group editor-insert-actions">{toolbarButton("Insert image", () => { setMediaOpen((open) => !open); setMediaError(""); })}{toolbarButton("Insert emoji", () => setEmojiOpen((open) => !open))}</div>
            {mediaOpen && <div className="editor-popover" role="region" aria-label="Insert image"><div className="editor-popover-head"><strong>Images for this story</strong><button type="button" aria-label="Close image picker" onClick={() => setMediaOpen(false)}>Close</button></div><label className="pill primary upload-image-button">Upload an image<input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => void upload(event.target.files?.[0])}/></label><button type="button" className="pill" onClick={() => void openMedia()}>Choose uploaded image</button><p className="field-hint">JPEG, PNG, WebP, or GIF. Maximum 8 MB.</p>{mediaError && <p role="status">{mediaError}</p>}<div className="media-picker-grid">{media.map((item) => <button type="button" key={item.src} onClick={() => insertMedia(item)}><Image src={item.previewSrc} width={200} height={120} unoptimized alt=""/><span>{item.name}</span></button>)}</div>{imageNotice && <p role="status">{imageNotice}</p>}</div>}
            {emojiOpen && <div className="editor-popover emoji-popover" role="region" aria-label="Emoji picker"><div className="editor-popover-head"><strong>Insert an emoji</strong><button type="button" onClick={() => setEmojiOpen(false)}>Close</button></div><label className="sr-only" htmlFor="emoji-search">Search emoji</label><input id="emoji-search" placeholder="Search emoji by name" value={emojiSearch} onChange={(event) => setEmojiSearch(event.target.value)}/><div className="emoji-categories" role="group" aria-label="Emoji categories">{Object.keys(emojiGroups).map((category) => <button type="button" key={category} aria-pressed={emojiCategory === category} onClick={() => setEmojiCategory(category)}>{category}</button>)}</div><div className="emoji-grid">{emojiGroups[emojiCategory].map((emoji, index) => ({ emoji, terms: emojiTerms[emojiCategory]?.[index] ?? "" })).filter(({ emoji, terms }) => !emojiSearch || `${emoji} ${terms} ${emojiCategory}`.toLowerCase().includes(emojiSearch.trim().toLowerCase())).map(({ emoji, terms }) => <button key={emoji} type="button" aria-label={`Insert ${terms.split(" ")[0] ?? "emoji"}`} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</div></div>}
            {selectedImage && <div className="image-inspector" aria-label="Selected image settings"><strong>Image settings</strong><label>Alternative text<input value={String(editor.getAttributes("imageBlock").alt ?? "")} maxLength={300} onChange={(event) => updateImage("alt", event.target.value)}/></label><label>Caption<input value={String(editor.getAttributes("imageBlock").caption ?? "")} maxLength={500} onChange={(event) => updateImage("caption", event.target.value)}/></label><label>Width<input type="range" min="15" max="100" value={Number(editor.getAttributes("imageBlock").width ?? 100)} onChange={(event) => updateImage("width", Number(event.target.value))}/></label><label>Alignment<select value={String(editor.getAttributes("imageBlock").align ?? "center")} onChange={(event) => updateImage("align", event.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>{toolbarButton("Remove selected image", () => editor.chain().focus().deleteSelection().run())}</div>}
          </>}
          {sidebarTab === "literary" && <>
            <label className="editor-control">Literary style<select aria-label="Literary text style" value={treatmentValue} onChange={(event) => { setActiveTreatment(event.target.value); applyTreatment(event.target.value); }}>{literaryTreatments.map((treatment) => <option key={treatment} value={treatment}>{treatmentLabel(treatment)}</option>)}</select></label>
            <p className="editor-sidebar-help">Wrap the current paragraph in a reusable literary treatment. Whispers use subdued type; other treatments keep readable contrast.</p>
          </>}
          {sidebarTab === "document" && <>
            <div className="editor-control-group">{toolbarButton("Insert divider", () => editor.chain().focus().setHorizontalRule().run())}{toolbarButton("Insert code block", () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive("codeBlock"))}{toolbarButton("Add or edit link", setLink, editor.isActive("link"))}{toolbarButton("Clear formatting", () => editor.chain().focus().unsetAllMarks().clearNodes().run())}</div>
            <p className="editor-document-stats">{wordCount.toLocaleString()} words · {Math.max(1, Math.ceil(wordCount / 220))} min read</p>
          </>}
        </div>
      </aside>
    </div>
  </section>;
}
