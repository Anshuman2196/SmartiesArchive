"use client";

import { Node, Mark, Extension, mergeAttributes } from "@tiptap/core";
import Image from "next/image";
import { ArrowLeft, MoreHorizontal, Settings2 } from "lucide-react";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { TableKit } from "@tiptap/extension-table";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Fragment, Slice } from "@tiptap/pm/model";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { listWorkMedia, publishChapter, saveRichChapter } from "@/app/actions";
import { uploadStoryMediaFile } from "@/lib/client-story-upload";
import { chapterContentLimits, literaryTreatments, plainTextFromRichDocument, type RichDocument } from "@/lib/rich-document";
import { detectLiteraryTreatment } from "@/lib/literary-detection";
import { normalizeChapterPaste } from "@/lib/chapter-paste";
import { expandInlineMarkdown, markdownRunsForPreview } from "@/lib/markdown-preview";
import { RichDocumentRenderer } from "@/components/rich-document-renderer";
import { createEditorShortcutExtension, detectShortcutPlatform, editorShortcutDefinitions, formatShortcut, type EditorShortcutCallbacks, type EditorShortcutDefinition, type ShortcutPlatform } from "@/lib/editor-shortcuts";
import styles from "./rich-chapter-editor.module.css";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(",");

const getFocusableElements = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => !element.hasAttribute("aria-hidden") && element.offsetParent !== null);

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
  StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] }, link: { openOnClick: false } }),
  Markdown.configure({ markedOptions: { breaks: true } }), TableKit, TaskList, TaskItem,
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
const saveTimeLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export function RichChapterEditor({ workId, initialDocument, initialTitle, initialChapterId, initialUpdatedAt }: { workId: string; initialDocument: RichDocument; initialTitle: string; initialChapterId?: string; initialUpdatedAt?: string }) {
  const [title, setTitle] = useState(initialTitle);
  const [chapterId, setChapterId] = useState(initialChapterId);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt ?? "");
  const [status, setStatus] = useState(initialChapterId ? "Saved" : "Unsaved draft");
  const [saveError, setSaveError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [documentRevision, setDocumentRevision] = useState(0);
  const [saveFinished, setSaveFinished] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
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
  const [detectionNotice, setDetectionNotice] = useState("");
  const [imageNotice, setImageNotice] = useState("");
  const [importNotice, setImportNotice] = useState("");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState("");
  const markdownRef = useRef<HTMLInputElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const imageAltRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const documentRef = useRef<RichDocument>(initialDocument);
  const titleRef = useRef(initialTitle);
  const revisionRef = useRef(0);
  const busy = useRef(false);
  const shortcutCallbacksRef = useRef<EditorShortcutCallbacks>({});
  const editorRootRef = useRef<HTMLElement>(null);
  const formatToggleRef = useRef<HTMLButtonElement>(null);
  const formatCloseRef = useRef<HTMLButtonElement>(null);
  const sidebarReturnFocusRef = useRef<HTMLElement | null>(null);
  const overflowTriggerRef = useRef<HTMLButtonElement>(null);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const overflowReturnFocusRef = useRef<HTMLElement | null>(null);
  const shortcutHelpCloseRef = useRef<HTMLButtonElement>(null);
  const shortcutHelpReturnFocusRef = useRef<HTMLElement | null>(null);
  const sidebarWasOpenRef = useRef(false);
  const overflowWasOpenRef = useRef(false);
  const shortcutHelpWasOpenRef = useRef(false);
  const linkDialogWasOpenRef = useRef(false);
  const router = useRouter();

  const shortcutExtension = useMemo(() => createEditorShortcutExtension(shortcutCallbacksRef), []);
  const editor = useEditor({ extensions: [...extensions, shortcutExtension], content: initialDocument, immediatelyRender: false, editorProps: {
    attributes: { role: "textbox", "aria-label": "Chapter content", "aria-multiline": "true", "aria-describedby": "rich-editor-content-help" },
    handlePaste(view, event) {
      const text = event.clipboardData?.getData("text/plain");
      if (!text || view.state.selection.$from.parent.type.name === "codeBlock") return false;
      const html = event.clipboardData?.getData("text/html") ?? "";
      const hadFormatting = /<(?:h[1-6]|ul|ol|li|blockquote|strong|em|b|i|u|table|thead|tbody|tr|td|th)\b/i.test(html);
      const paragraphs = normalizeChapterPaste(text).split(/\n\s*\n/).filter((paragraph) => paragraph.length > 0).map((paragraph) => {
        const content = paragraph.split("\n").flatMap((line, index) => [
          ...(index ? [view.state.schema.nodes.hardBreak.create()] : []),
          ...(line ? [view.state.schema.text(line)] : []),
        ]);
        return view.state.schema.nodes.paragraph.create(null, content);
      });
      const transaction = view.state.tr.replaceSelection(new Slice(Fragment.fromArray(paragraphs), 0, 0)).scrollIntoView();
      const candidate = transaction.doc.toJSON() as RichDocument;
      let nodeCount = 0;
      let oversized = false;
      const countNodes = (node: RichDocument | RichDocument["content"][number]): void => { nodeCount += 1; if ((node.content?.length ?? 0) > chapterContentLimits.children) oversized = true; for (const child of node.content ?? []) countNodes(child); };
      countNodes(candidate);
      if (oversized || plainTextFromRichDocument(candidate).length > chapterContentLimits.text || JSON.stringify(candidate).length > chapterContentLimits.json || nodeCount > chapterContentLimits.nodes) {
        setSaveError("This paste exceeds the chapter limit. Paste a shorter section or start another chapter.");
        return true;
      }
      view.dispatch(transaction);
      if (hadFormatting) setImportNotice("Pasted text was simplified, so its headings, lists, or emphasis were not kept.");
      return true;
    },
  }, onUpdate: ({ editor: instance }) => { documentRef.current = instance.getJSON() as RichDocument; revisionRef.current += 1; setDocumentRevision(revisionRef.current); setDirty(true); setSaveError(""); setStatus("Unsaved changes"); }, onSelectionUpdate: ({ editor: instance }) => setSelectionActive(!instance.state.selection.empty) });
  const save = useCallback(async () => {
    if (!dirty) { setStatus("No changes to save"); return true; }
    if (busy.current) return false;
    const revision = revisionRef.current;
    busy.current = true; setStatus("Saving draft…");
    // Preserve the first-chapter composer across the server refresh triggered by
    // revalidatePath. The studio page uses this query to keep the new editor mounted.
    if (!chapterId && typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", `/studio/${workId}?new=1`);
    }
    let result: Awaited<ReturnType<typeof saveRichChapter>>;
    try { result = await saveRichChapter(workId, chapterId, titleRef.current, documentRef.current, updatedAt); }
    catch { result = { ok: false, message: "The save could not reach the server. Your writing is still here; retry when connected." }; }
    finally { busy.current = false; }
    if (!result.ok) { setSaveError(result.message ?? "Draft could not be saved. Your writing is still here. Retry when ready."); setStatus("Not saved"); return false; }
    if (result.chapterId) {
      setChapterId(result.chapterId);
      if (!chapterId && typeof window !== "undefined") window.history.replaceState(window.history.state, "", `/studio/${workId}?chapter=${result.chapterId}`);
    }
    if (result.updatedAt) setUpdatedAt(result.updatedAt);
    setSaveError("");
    if (revision === revisionRef.current) { setDirty(false); setStatus("Saved"); return true; }
    setStatus("Unsaved changes");
    setSaveFinished((value) => value + 1);
    return false;
  }, [chapterId, dirty, updatedAt, workId]);

  useEffect(() => { if (!dirty) return; if (saveTimer.current) clearTimeout(saveTimer.current); saveTimer.current = setTimeout(() => { void save(); }, 1300); return () => { if (saveTimer.current) clearTimeout(saveTimer.current); }; }, [dirty, documentRevision, saveFinished, save]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  useEffect(() => {
    const editorUrl = window.location.href;
    const editorHistoryState = window.history.state;
    const guardLink = (event: MouseEvent) => {
      if (!dirty || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      void save().then((saved) => { if (saved) router.push(`${url.pathname}${url.search}${url.hash}`); });
    };
    const guardBack = () => {
      if (!dirty) return;
      // popstate fires after the browser has already moved. Restore the editor
      // entry before prompting so cancel keeps the unsaved document mounted.
      window.history.pushState(editorHistoryState, "", editorUrl);
      if (!window.confirm("This chapter has unsaved changes. Save them before leaving?")) return;
      void save().then((saved) => { if (saved) window.history.back(); });
    };
    document.addEventListener("click", guardLink, true);
    window.addEventListener("popstate", guardBack);
    return () => { document.removeEventListener("click", guardLink, true); window.removeEventListener("popstate", guardBack); };
  }, [dirty, router, save]);
  useEffect(() => { setShortcutPlatform(detectShortcutPlatform()); }, []);
  const restoreFocus = useCallback((target: HTMLElement | null, fallback: HTMLElement | null = null) => {
    window.requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
      else if (fallback?.isConnected) fallback.focus();
      else editor?.commands.focus();
    });
  }, [editor]);
  useEffect(() => {
    if (sidebarOpen) {
      sidebarWasOpenRef.current = true;
      window.requestAnimationFrame(() => formatCloseRef.current?.focus());
      return;
    }
    if (!sidebarWasOpenRef.current) return;
    sidebarWasOpenRef.current = false;
    restoreFocus(sidebarReturnFocusRef.current, formatToggleRef.current);
    sidebarReturnFocusRef.current = null;
  }, [restoreFocus, sidebarOpen]);
  useEffect(() => {
    if (overflowOpen) {
      overflowWasOpenRef.current = true;
      window.requestAnimationFrame(() => {
        const firstItem = overflowMenuRef.current ? getFocusableElements(overflowMenuRef.current)[0] : null;
        firstItem?.focus();
      });
      return;
    }
    if (!overflowWasOpenRef.current) return;
    overflowWasOpenRef.current = false;
    restoreFocus(overflowReturnFocusRef.current, overflowTriggerRef.current);
    overflowReturnFocusRef.current = null;
  }, [overflowOpen, restoreFocus]);
  useEffect(() => {
    if (shortcutHelpOpen) {
      shortcutHelpWasOpenRef.current = true;
      window.requestAnimationFrame(() => shortcutHelpCloseRef.current?.focus());
      return;
    }
    if (!shortcutHelpWasOpenRef.current) return;
    shortcutHelpWasOpenRef.current = false;
    restoreFocus(shortcutHelpReturnFocusRef.current, formatToggleRef.current);
    shortcutHelpReturnFocusRef.current = null;
  }, [restoreFocus, shortcutHelpOpen]);
  useEffect(() => {
    if (!overflowOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof window.Node && !overflowMenuRef.current?.parentElement?.contains(event.target)) setOverflowOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [overflowOpen]);

  const wordCount = plainTextFromRichDocument(documentRef.current).trim().split(/\s+/).filter(Boolean).length;
  const activeBlock = editor?.isActive("heading") ? "heading" : editor?.isActive("literaryBlock") ? "literaryBlock" : "paragraph";
  const changeIndent = (amount: number) => { if (!editor) return; const current = Number(editor.getAttributes(activeBlock).indent ?? 0); editor.chain().focus().updateAttributes(activeBlock, { indent: Math.max(0, Math.min(4, current + amount)) }).run(); };
  const applyTreatment = (treatment: string) => { if (!editor) return; if (editor.isActive("literaryBlock")) editor.chain().focus().updateAttributes("literaryBlock", { treatment }).run(); else editor.chain().focus().wrapIn("literaryBlock", { treatment }).run(); };
  const autoDetectTreatments = () => {
    if (!editor) return;
    const { state, view } = editor;
    const matches: Array<{ pos: number; treatment: string }> = [];
    state.doc.forEach((node, pos) => {
      const treatment = detectLiteraryTreatment(node.toJSON());
      if (treatment) matches.push({ pos, treatment });
    });
    if (!matches.length) { setDetectionNotice("No clear style cues found in plain paragraphs."); return; }
    let transaction = state.tr;
    for (const { pos, treatment } of matches.reverse()) {
      const paragraph = transaction.doc.nodeAt(pos);
      if (!paragraph) continue;
      const wrapper = state.schema.nodes.literaryBlock.create({ treatment }, paragraph);
      transaction = transaction.replaceWith(pos, pos + paragraph.nodeSize, wrapper);
    }
    view.dispatch(transaction.scrollIntoView());
    setDetectionNotice(`Styled ${matches.length} ${matches.length === 1 ? "paragraph" : "paragraphs"}. Review the result; Undo restores the previous formatting.`);
  };
  const insertMedia = (item: { src: string; previewSrc: string }) => { if (!editor) return; const attrs = { src: item.src, previewSrc: item.previewSrc, alt: "", caption: "", width: 100, align: "center" }; if (editor.isActive("imageBlock")) editor.chain().focus().updateAttributes("imageBlock", attrs).run(); else editor.chain().focus().insertContent({ type: "imageBlock", attrs }).run(); setMediaOpen(false); setImageNotice("Image inserted. Add a description in Image settings if it conveys story information."); };
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
  const openSidebar = () => {
    if (!sidebarOpen) {
      const activeElement = document.activeElement;
      sidebarReturnFocusRef.current = activeElement instanceof HTMLElement ? activeElement : formatToggleRef.current;
    }
    setSidebarOpen(true);
  };
  const closeSidebar = () => setSidebarOpen(false);
  const openOverflow = () => {
    if (!overflowOpen) {
      const activeElement = document.activeElement;
      overflowReturnFocusRef.current = activeElement instanceof HTMLElement ? activeElement : overflowTriggerRef.current;
    }
    setOverflowOpen(true);
  };
  const closeOverflow = () => setOverflowOpen(false);
  const openShortcutHelp = (returnFocus?: HTMLElement | null) => {
    if (!shortcutHelpOpen) {
      const activeElement = document.activeElement;
      shortcutHelpReturnFocusRef.current = returnFocus ?? (activeElement instanceof HTMLElement ? activeElement : formatToggleRef.current);
    }
    setShortcutHelpOpen(true);
  };
  const openImagePicker = () => { setSidebarTab("insert"); openSidebar(); setMediaError(""); setMediaOpen(true); void loadMedia(); };
  const insertEmoji = (emoji: string) => { editor?.chain().focus().insertContent(emoji).run(); setEmojiOpen(false); setEmojiSearch(""); };
  const setLink = () => { if (!editor) return; setLinkValue(editor.getAttributes("link").href ?? ""); setLinkError(""); setLinkDialogOpen(true); };
  const submitLink = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;
    const href = linkValue.trim();
    if (href && (!/^(https:|mailto:|\/)/i.test(href) || href.startsWith("//") || /[\\\u0000-\u001f]/.test(href))) { setLinkError("Use an HTTPS, mailto, or internal story link."); return; }
    if (!href) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().setLink({ href }).run();
    setLinkDialogOpen(false);
  };
  const updateImage = (key: "alt" | "caption" | "width" | "align", value: string | number) => editor?.chain().focus().updateAttributes("imageBlock", { [key]: value }).run();

  if (!editor) return <div className="rich-editor-loading" role="status">Preparing your writing space…</div>;
  const togglePreview = () => {
    if (preview) { setPreview(false); return; }
    const runs = markdownRunsForPreview(editor.getJSON() as RichDocument);
    try {
      if (!editor.markdown) throw new Error("Markdown preview is unavailable. Reload the editor and try again.");
      let candidate = editor.getJSON() as RichDocument;
      let changed = false;
      if (runs.length) {
        const transaction = editor.state.tr;
        for (const run of runs.reverse()) {
          if (/!\[[^\]]*\]\([^)]*\)|<img\b/i.test(run.source)) throw new Error("Upload images through the image picker before previewing Markdown image links.");
          const parsed = editor.markdown.parse(run.source);
          const nodes = (parsed.content ?? []).map((node) => editor.schema.nodeFromJSON(node));
          if (!nodes.length) continue;
          let from = 0;
          for (let index = 0; index < run.start; index += 1) from += editor.state.doc.child(index).nodeSize;
          let to = from;
          for (let index = run.start; index < run.end; index += 1) to += editor.state.doc.child(index).nodeSize;
          transaction.replaceWith(from, to, Fragment.fromArray(nodes));
        }
        candidate = transaction.doc.toJSON() as RichDocument;
        changed = transaction.docChanged;
      }
      const inline = expandInlineMarkdown(candidate, (source) => editor.markdown!.parse(source) as RichDocument);
      if (inline.changed) { candidate = inline.document; changed = true; }
      if (changed) {
        const normalized = editor.schema.nodeFromJSON(candidate).toJSON() as RichDocument;
        let count = 0;
        let oversized = false;
        const walk = (node: RichDocument | RichDocument["content"][number]) => { count += 1; if ((node.content?.length ?? 0) > chapterContentLimits.children) oversized = true; for (const child of node.content ?? []) walk(child); };
        walk(normalized);
        if (oversized || count > chapterContentLimits.nodes || JSON.stringify(normalized).length > chapterContentLimits.json || plainTextFromRichDocument(normalized).length > chapterContentLimits.text) throw new Error("This Markdown exceeds the chapter limit. Split it into shorter chapters.");
        editor.commands.setContent(normalized);
        setImportNotice("");
      }
    } catch (error) {
      setImportNotice(error instanceof Error ? error.message : "Could not preview this Markdown.");
      return;
    }
    setPreview(true);
  };
  shortcutCallbacksRef.current = {
    onLink: setLink,
    onIndent: () => changeIndent(1),
    onOutdent: () => changeIndent(-1),
    onInsertImage: openImagePicker,
    onInsertEmoji: () => { setSidebarTab("insert"); openSidebar(); setEmojiOpen(true); setEmojiSearch(""); },
    onSave: () => { void save(); },
    onTogglePreview: togglePreview,
    onToggleFocusMode: () => setFocusMode((focused) => !focused),
    onOpenHelp: () => openShortcutHelp(),
  };
  const selectedImage = editor.isActive("imageBlock");
  useEffect(() => {
    if (selectedImage && sidebarOpen && sidebarTab === "insert") window.requestAnimationFrame(() => imageAltRef.current?.focus());
  }, [selectedImage, sidebarOpen, sidebarTab]);
  const treatmentValue = literaryTreatments.find((item) => item === activeTreatment) ?? "narration";
  const toolbarButton = (label: string, command: () => void, active = false, disabled = false) => <button type="button" className="editor-tool-button" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={command}>{label}</button>;
  const menuButton = (label: string, command: () => void, disabled = false) => <button type="button" role="menuitem" className="editor-top-action" aria-label={label} disabled={disabled} onClick={() => { command(); closeOverflow(); }}>{label}</button>;
  const handleOverflowKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = overflowMenuRef.current ? getFocusableElements(overflowMenuRef.current) : [];
    if (event.key === "Escape") { event.preventDefault(); closeOverflow(); return; }
    if (!items.length || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (currentIndex + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  const textStyle = editor.getAttributes("textStyle") as Record<string, string | null>;
  const headingValue = [1, 2, 3, 4, 5, 6].find((level) => editor.isActive("heading", { level }));
  const blockValue = headingValue ? `h${headingValue}` : editor.isActive("blockquote") ? "quote" : "p";
  const changeBlock = (value: string) => { if (value === "quote") editor.chain().focus().setBlockquote().run(); else if (value === "p") editor.chain().focus().setParagraph().run(); else editor.chain().focus().toggleHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run(); };
  const setTextColor = (value: string) => editor.chain().focus().setColor(value).run();
  const tabs = [{ id: "text", label: "Text" }, { id: "type", label: "Typography" }, { id: "insert", label: "Insert" }, { id: "literary", label: "Literary" }, { id: "document", label: "Document" }];
  const downloadRecovery = () => {
    const recovery = new Blob([JSON.stringify({ title: titleRef.current, document: editor.getJSON(), savedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(recovery); const link = document.createElement("a"); link.href = url; link.download = "smarties-chapter-recovery.json"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importMarkdown = async (file?: File) => {
    if (!file) return;
    setImportNotice("");
    try {
      if (!/\.(md|markdown)$/i.test(file.name)) throw new Error("Choose a .md or .markdown file.");
      if (file.size > chapterContentLimits.text * 2) throw new Error("This Markdown file is too large for one chapter.");
      const source = (await file.text()).replace(/^\uFEFF/, "");
      if (/!\[[^\]]*\]\([^)]*\)|<img\b/i.test(source)) throw new Error("This file contains images. Upload them through the image picker, then import the Markdown without image links.");
      if (!editor.markdown) throw new Error("Markdown import is unavailable. Reload the editor and try again.");
      const parsed = editor.markdown.parse(source);
      if (!parsed.content?.length) throw new Error("This file has no chapter content to import.");
      const nodes = parsed.content.map((item) => editor.schema.nodeFromJSON(item));
      const transaction = editor.state.tr.replaceSelection(new Slice(Fragment.fromArray(nodes), 0, 0)).scrollIntoView();
      const candidate = transaction.doc.toJSON() as RichDocument;
      let count = 0;
      let oversized = false;
      const walk = (node: RichDocument | RichDocument["content"][number]) => { count += 1; if ((node.content?.length ?? 0) > chapterContentLimits.children) oversized = true; for (const child of node.content ?? []) walk(child); };
      walk(candidate);
      if (oversized || count > chapterContentLimits.nodes || JSON.stringify(candidate).length > chapterContentLimits.json || plainTextFromRichDocument(candidate).length > chapterContentLimits.text) throw new Error("This file exceeds the chapter limit. Split it into shorter chapters.");
      editor.view.dispatch(transaction);
      editor.commands.focus();
      setImportNotice(`Imported ${file.name} at the cursor. Review the chapter before saving.`);
    } catch (error) {
      setImportNotice(error instanceof Error ? error.message : "Could not import this Markdown file.");
    } finally {
      if (markdownRef.current) markdownRef.current.value = "";
    }
  };
  const formattingMore = () => { setSidebarTab("type"); openSidebar(); };
  const shortcutCategories: EditorShortcutDefinition["category"][] = ["Formatting", "Structure", "Insert", "Editor"];
  const closeShortcutHelp = () => setShortcutHelpOpen(false);

  useEffect(() => {
    if (linkDialogOpen) {
      linkDialogWasOpenRef.current = true;
      window.requestAnimationFrame(() => linkInputRef.current?.focus());
    } else if (linkDialogWasOpenRef.current && editor) {
      linkDialogWasOpenRef.current = false;
      window.requestAnimationFrame(() => editor.commands.focus());
    }
  }, [editor, linkDialogOpen]);

  return <section ref={editorRootRef} className={`${styles.editorRoot} rich-editor ${focusMode ? "is-focused" : ""} ${sidebarOpen ? "sidebar-open" : "sidebar-closed"} ${sidebarOpen ? "" : "format-drawer-closed"}`} role="region" aria-labelledby="rich-editor-label">
    <h1 id="rich-editor-label" className={styles.visuallyHidden}>Chapter writing editor</h1>
    <header className="editor-topbar">
      <div className="editor-topbar-context"><button type="button" className="editor-back-link" aria-label="Return to Creator Studio" onClick={async () => { if (await save()) router.push(`/studio/${workId}`); }}><ArrowLeft size={17} aria-hidden="true"/><span>Creator Studio</span></button><span aria-hidden="true">/</span><span className="editor-breadcrumb">{title || "Untitled chapter"}</span></div>
      <div className="editor-topbar-actions">
        <span className={`editor-save-status ${saveError ? "has-error" : ""}`} role="status" aria-live="polite"><i aria-hidden="true"/> {saveError ? "Not saved" : status === "Saved" && updatedAt ? `Saved at ${saveTimeLabel(updatedAt)}` : status}</span>
        <button ref={formatToggleRef} type="button" className="editor-top-action editor-format-toggle" aria-label="Open formatting panel" aria-expanded={sidebarOpen} aria-controls="editor-format-sidebar" onClick={() => sidebarOpen ? closeSidebar() : openSidebar()} title="Formatting options"><Settings2 size={18} aria-hidden="true"/></button>
        <button type="button" className="pill primary editor-save" disabled={!dirty || busy.current} onClick={() => void save()}>{saveError ? "Retry save" : "Save draft"}</button>
        <div className="editor-overflow">
          <button ref={overflowTriggerRef} type="button" className={styles.overflowTrigger} aria-label="More chapter actions" aria-haspopup="menu" aria-expanded={overflowOpen} aria-controls="editor-overflow-menu" onClick={() => overflowOpen ? closeOverflow() : openOverflow()} title="More chapter actions"><MoreHorizontal size={19} aria-hidden="true"/></button>
          {overflowOpen && <div ref={overflowMenuRef} id="editor-overflow-menu" className="editor-overflow-menu" role="menu" aria-label="More chapter actions" onKeyDown={handleOverflowKeyDown}>
            {menuButton("Undo", () => editor.chain().focus().undo().run(), !editor.can().undo())}{menuButton("Redo", () => editor.chain().focus().redo().run(), !editor.can().redo())}
            {menuButton(preview ? "Return to writing" : "Preview current edits", togglePreview)}
            {menuButton(focusMode ? "Exit focus mode" : "Focus mode", () => setFocusMode(!focusMode))}
            {menuButton("Import Markdown file", () => markdownRef.current?.click())}
            <button type="button" role="menuitem" className="editor-top-action" onClick={() => { closeOverflow(); openShortcutHelp(overflowTriggerRef.current); }}>Keyboard shortcuts</button>
            {menuButton("Download recovery copy", downloadRecovery)}
          </div>}
        </div>
      </div>
    </header>
    <div className={styles.quickToolbar} role="toolbar" aria-label="Writing tools">
      <div className={styles.quickTools} role="group" aria-label="Text formatting">
        <label className="sr-only" htmlFor="quick-block-style">Text style</label><select id="quick-block-style" aria-label="Text style" value={blockValue} onChange={(event) => changeBlock(event.target.value)}><option value="p">Paragraph</option>{[1,2,3,4,5,6].map((level) => <option key={level} value={`h${level}`}>Heading {level}</option>)}<option value="quote">Blockquote</option></select>
        {toolbarButton("Undo", () => editor.chain().focus().undo().run(), false, !editor.can().undo())}{toolbarButton("Redo", () => editor.chain().focus().redo().run(), false, !editor.can().redo())}
        {toolbarButton("Bold", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}{toolbarButton("Italic", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
        {toolbarButton("Bulleted list", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}{toolbarButton("Numbered list", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}{toolbarButton("Task list", () => editor.commands.toggleTaskList(), editor.isActive("taskList"))}
        {toolbarButton("Blockquote", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}{toolbarButton("Insert table", () => editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true }))}{toolbarButton("Add or edit link", setLink, editor.isActive("link"))}{toolbarButton("Insert image", () => { setSidebarTab("insert"); setMediaOpen(true); setMediaError(""); openSidebar(); })}{toolbarButton("Spoiler", () => editor.chain().focus().toggleMark("spoiler").run(), editor.isActive("spoiler"))}
      </div>
      <div className={styles.quickActions} role="group" aria-label="Preview and publishing">
        <button type="button" className="pill" aria-pressed={preview} onClick={togglePreview}>{preview ? "Return to writing" : "Preview"}</button>
        {chapterId && <><form action={publishChapter} className="editor-publish-form"><input type="hidden" name="workId" value={workId}/><input type="hidden" name="chapterId" value={chapterId}/><button className="pill primary" type="submit" disabled={dirty || !!saveError} title={dirty || saveError ? "Save your changes before publishing." : undefined} aria-describedby={dirty || saveError ? "editor-publish-hint" : undefined}>Publish saved draft</button></form>{(dirty || saveError) && <span id="editor-publish-hint" className="editor-publish-hint" role="status">Save your changes before publishing.</span>}</>}
      </div>
    </div>
    <input ref={markdownRef} className="sr-only" type="file" accept=".md,.markdown,text/markdown" aria-label="Markdown chapter file" onChange={(event) => void importMarkdown(event.target.files?.[0])}/>
    {importNotice && <div className="editor-import-notice" role="status">{importNotice}<button type="button" aria-label="Dismiss import message" onClick={() => setImportNotice("")}>×</button></div>}
    {linkDialogOpen && <div className="editor-dialog-backdrop"><section className="editor-link-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-link-title" aria-describedby="editor-link-help"><h2 id="editor-link-title">Add or edit link</h2><p id="editor-link-help">Use an HTTPS address, an email link, or an internal story path. Leave blank to remove the link.</p><form onSubmit={submitLink}><label htmlFor="editor-link-address">Link address</label><input ref={linkInputRef} id="editor-link-address" type="text" inputMode="url" autoComplete="url" value={linkValue} onChange={(event) => setLinkValue(event.target.value)} aria-invalid={!!linkError} aria-describedby={linkError ? "editor-link-error" : "editor-link-help"}/>{linkError && <p id="editor-link-error" role="alert">{linkError}</p>}<div><button type="button" className="pill" onClick={() => setLinkDialogOpen(false)}>Cancel</button><button type="submit" className="pill primary">Apply link</button></div></form></section></div>}
    {saveError && <div className="editor-save-error" role="alert"><span>{saveError} Your words and formatting remain in this editor.</span><button type="button" onClick={() => void save()}>Retry save</button><button type="button" onClick={downloadRecovery}>Download recovery copy</button></div>}
    {shortcutHelpOpen && <div className="editor-popover" role="dialog" aria-modal="false" aria-labelledby="editor-shortcut-help-title" aria-describedby="editor-shortcut-help-description" onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); closeShortcutHelp(); return; }
      if (event.key !== "Tab") return;
      const focusable = getFocusableElements(event.currentTarget);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
      <div className="editor-popover-head"><strong id="editor-shortcut-help-title">Keyboard shortcuts</strong><button ref={shortcutHelpCloseRef} type="button" onClick={closeShortcutHelp}>Close</button></div>
      <p id="editor-shortcut-help-description" className="editor-sidebar-help">Shortcuts work while your cursor is in the chapter editor. Formatting controls such as font, size, and color remain in the Formatting panel.</p>
      {shortcutCategories.map((category) => <section key={category} aria-labelledby={`shortcut-category-${category.toLowerCase()}`}>
        <h3 id={`shortcut-category-${category.toLowerCase()}`} className="eyebrow">{category}</h3>
        <div className="editor-sidebar-panel" style={{ gap: 6, paddingTop: 6 }}>
          {editorShortcutDefinitions.filter((definition) => definition.category === category).map((definition) => <div key={definition.id} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}><span><strong>{definition.label}</strong><small style={{ display: "block", color: "var(--muted)" }}>{definition.description}</small></span><kbd>{formatShortcut(definition.shortcut, shortcutPlatform)}</kbd></div>)}
        </div>
      </section>)}
    </div>}
    <div className="editor-workspace">
      <section className="editor-writing-column" aria-label="Chapter writing area">
        <div className="rich-editor-heading"><label className="sr-only" htmlFor="rich-chapter-title">Chapter title</label><textarea id="rich-chapter-title" rows={1} placeholder="Untitled chapter" value={title} maxLength={120} onInput={(event) => { event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`; }} onChange={(event) => { setTitle(event.target.value); titleRef.current = event.target.value; revisionRef.current += 1; setDocumentRevision(revisionRef.current); setDirty(true); setSaveError(""); setStatus("Unsaved changes"); }}/></div>
        {selectionActive && !preview && <div className="editor-selection-toolbar" role="toolbar" aria-label="Selected text formatting">
          {toolbarButton("Bold", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}{toolbarButton("Italic", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}{toolbarButton("Underline", () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}{toolbarButton("Highlight", () => editor.chain().focus().toggleHighlight({ color: "#d4f36a" }).run(), editor.isActive("highlight"))}
          <label className="sr-only" htmlFor="selection-text-color">Text color</label><input id="selection-text-color" type="color" aria-label="Selected text color" value={textStyle.color ?? "#f1eadb"} onChange={(event) => setTextColor(event.target.value)}/>
          {toolbarButton("Link", setLink, editor.isActive("link"))}{toolbarButton("Spoiler", () => editor.chain().focus().toggleMark("spoiler").run(), editor.isActive("spoiler"))}<button type="button" className="editor-tool-button" onClick={formattingMore} aria-label="More formatting">More</button>
        </div>}
        {preview && <p className="editor-preview-banner" role="status">Previewing current edits · Return to writing from More chapter actions.</p>}
        {preview ? <article className="rich-editor-preview prose-content rich-reader"><RichDocumentRenderer document={editor.getJSON() as RichDocument}/></article> : <div className="rich-editor-canvas prose-content rich-reader"><p id="rich-editor-content-help" className={styles.visuallyHidden}>Chapter content editor. Use the formatting panel or keyboard shortcuts to format your writing.</p><EditorContent editor={editor}/></div>}
        <footer className="editor-writing-footer"><span className="editor-word-count">{wordCount.toLocaleString()} words · {Math.max(1, Math.ceil(wordCount / 220))} min read</span></footer>
      </section>
      <aside id="editor-format-sidebar" className="editor-format-sidebar" role="dialog" aria-modal="false" aria-labelledby="editor-format-title" aria-hidden={!sidebarOpen} inert={!sidebarOpen} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeSidebar(); } }}>
        <div className="editor-sidebar-heading"><span id="editor-format-title" className="eyebrow">Formatting controls</span><button ref={formatCloseRef} type="button" className={`${styles.dialogClose} editor-sidebar-close`} onClick={closeSidebar} aria-label="Close formatting panel">Close</button></div>
        <div className="editor-sidebar-tabs" role="tablist" aria-label="Formatting sections">{tabs.map((tab) => <button key={tab.id} id={`editor-tab-${tab.id}`} type="button" role="tab" aria-selected={sidebarTab === tab.id} aria-controls="editor-sidebar-panel" onClick={() => setSidebarTab(tab.id)}>{tab.label}</button>)}</div>
        <div id="editor-sidebar-panel" role="tabpanel" aria-labelledby={`editor-tab-${sidebarTab}`} className="editor-sidebar-panel">
          {sidebarTab === "text" && <>
            <label className="editor-control">Paragraph style<select aria-label="Paragraph style" value={blockValue} onChange={(event) => changeBlock(event.target.value)}><option value="p">Paragraph</option>{[1,2,3,4,5,6].map((level) => <option key={level} value={`h${level}`}>Heading {level}</option>)}<option value="quote">Blockquote</option></select></label>
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
            {selectedImage && <div className="image-inspector" aria-label="Selected image settings"><strong>Image settings</strong><label>Alternative text<input ref={imageAltRef} aria-describedby="image-alt-help" value={String(editor.getAttributes("imageBlock").alt ?? "")} maxLength={300} onChange={(event) => updateImage("alt", event.target.value)}/></label><p id="image-alt-help" className="field-hint">Describe meaningful images. Leave blank for decoration or if the nearby text already explains the image.</p><label>Caption<input value={String(editor.getAttributes("imageBlock").caption ?? "")} maxLength={500} onChange={(event) => updateImage("caption", event.target.value)}/></label><label>Width<input type="range" min="15" max="100" value={Number(editor.getAttributes("imageBlock").width ?? 100)} onChange={(event) => updateImage("width", Number(event.target.value))}/></label><label>Alignment<select value={String(editor.getAttributes("imageBlock").align ?? "center")} onChange={(event) => updateImage("align", event.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>{toolbarButton("Remove selected image", () => editor.chain().focus().deleteSelection().run())}</div>}
          </>}
          {sidebarTab === "literary" && <>
            <button type="button" className="pill editor-detect-styles" onClick={autoDetectTreatments}>Auto-detect styles in chapter</button>
            <p className="editor-sidebar-help">Finds clear dialogue, letter openings, and system notices in plain paragraphs. Existing styles stay as written.</p>
            {detectionNotice && <p className="editor-sidebar-help" role="status">{detectionNotice}</p>}
            <label className="editor-control">Literary style<select aria-label="Literary text style" value={treatmentValue} onChange={(event) => { setActiveTreatment(event.target.value); applyTreatment(event.target.value); }}>{literaryTreatments.map((treatment) => <option key={treatment} value={treatment}>{treatmentLabel(treatment)}</option>)}</select></label>
            <p className="editor-sidebar-help">Choose a style for the current paragraph when the wording needs your judgment.</p>
          </>}
          {sidebarTab === "document" && <>
            <div className="editor-control-group">{toolbarButton("Insert divider", () => editor.chain().focus().setHorizontalRule().run())}{toolbarButton("Insert code block", () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive("codeBlock"))}{toolbarButton("Add or edit link", setLink, editor.isActive("link"))}{toolbarButton("Clear formatting", () => editor.chain().focus().unsetAllMarks().clearNodes().run())}</div>
            <p className="editor-document-stats">{wordCount.toLocaleString()} words · {Math.max(1, Math.ceil(wordCount / 220))} min read</p>
            <button type="button" className="pill" onClick={downloadRecovery}>Download recovery copy</button>
          </>}
        </div>
      </aside>
    </div>
  </section>;
}
