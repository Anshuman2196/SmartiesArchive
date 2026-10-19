import { z } from "zod";

export const literaryTreatments = ["narration", "dialogue", "thought", "whisper", "letter", "system", "caption", "glitch", "emphasis", "important", "callout"] as const;
export type LiteraryTreatment = (typeof literaryTreatments)[number];

export type RichNode = { type: string; attrs?: Record<string, unknown>; text?: string; marks?: Array<{ type: string; attrs?: Record<string, unknown> }>; content?: RichNode[] };
export type RichDocument = { type: "doc"; content: RichNode[] };

const allowedNodes = new Set(["doc", "paragraph", "heading", "text", "bulletList", "orderedList", "listItem", "blockquote", "horizontalRule", "codeBlock", "hardBreak", "literaryBlock", "imageBlock"]);
const allowedMarks = new Set(["bold", "italic", "underline", "strike", "code", "highlight", "textStyle", "link", "superscript", "subscript"]);
const blockNodes = new Set(["paragraph", "heading", "bulletList", "orderedList", "blockquote", "horizontalRule", "codeBlock", "literaryBlock", "imageBlock"]);
const inlineNodes = new Set(["text", "hardBreak"]);
const textStyleSchema = z.object({ color: z.string().regex(/^#[\da-f]{3}(?:[\da-f]{3})?$/i).optional(), backgroundColor: z.string().regex(/^#[\da-f]{3}(?:[\da-f]{3})?$/i).optional(), fontFamily: z.enum(["Georgia", "Palatino", "Arial", "Verdana", "Courier New"]).optional(), fontSize: z.string().regex(/^(1[2-9]|[2-4]\d)px$/).optional() }).strict();
const safeLink = (href: unknown) => typeof href === "string" && !/[\\\u0000-\u001f]/.test(href) && (href.startsWith("/") && !href.startsWith("//") || /^(https?:|mailto:)/i.test(href));
const storageRef = (value: unknown, ownerId: string, workId: string) => typeof value === "string" && new RegExp(`^storage://story-media/${ownerId}/${workId}/[a-f0-9-]{36}\\.(?:png|jpe?g|webp|gif)$`, "i").test(value);

export function legacyTextToRichDocument(text: string): RichDocument {
  return { type: "doc", content: text.split(/\n{2,}/).map((paragraph) => ({ type: "paragraph", content: paragraph ? [{ type: "text", text: paragraph }] : [] })) };
}

export function plainTextFromRichDocument(document: RichDocument): string {
  const output: string[] = [];
  const walk = (node: RichNode) => {
    if (node.type === "text" && typeof node.text === "string") output.push(node.text);
    else if (node.type === "hardBreak") output.push("\n");
    else if (node.type === "imageBlock") output.push(String(node.attrs?.caption || node.attrs?.alt || "[Image]"));
    else for (const child of node.content ?? []) walk(child);
    if (["paragraph", "heading", "literaryBlock", "blockquote", "listItem"].includes(node.type)) output.push("\n\n");
  };
  walk(document);
  return output.join("").trim().slice(0, 100_000);
}

export function validateRichDocument(input: unknown, ownerId: string, workId: string): { document: RichDocument; plainText: string } {
  const parsed = z.record(z.string(), z.unknown()).safeParse(input);
  if (!parsed.success || parsed.data.type !== "doc" || !Array.isArray(parsed.data.content)) throw new Error("The chapter document is invalid.");
  if (JSON.stringify(input).length > 250_000) throw new Error("The chapter document is too large.");
  let nodeCount = 0;
  const walk = (node: unknown, depth: number): RichNode => {
    if (depth > 40 || ++nodeCount > 6000 || typeof node !== "object" || node === null || Array.isArray(node)) throw new Error("The chapter document is too complex.");
    const current = node as Record<string, unknown>;
    if (typeof current.type !== "string" || !allowedNodes.has(current.type)) throw new Error("The chapter contains an unsupported element.");
    const output: RichNode = { type: current.type };
    if (current.type === "text") {
      if (typeof current.text !== "string" || current.text.length > 20_000) throw new Error("The chapter text is invalid.");
      output.text = current.text;
    }
    if (current.attrs !== undefined) {
      if (typeof current.attrs !== "object" || current.attrs === null || Array.isArray(current.attrs)) throw new Error("The chapter formatting is invalid.");
      const attrs = current.attrs as Record<string, unknown>;
      if (current.type === "heading" && ![1, 2, 3].includes(Number(attrs.level))) throw new Error("Choose a heading level from one to three.");
      if (["paragraph", "heading", "literaryBlock"].includes(current.type) && attrs.indent !== undefined && (!Number.isInteger(attrs.indent) || Number(attrs.indent) < 0 || Number(attrs.indent) > 4)) throw new Error("The paragraph indent is out of range.");
      if (["paragraph", "heading"].includes(current.type) && attrs.textAlign !== undefined && !["left", "center", "right", "justify"].includes(String(attrs.textAlign))) throw new Error("The chapter alignment is invalid.");
      if (current.type === "literaryBlock" && !literaryTreatments.includes(attrs.treatment as LiteraryTreatment)) throw new Error("The literary style is invalid.");
      if (current.type === "imageBlock") {
        if (!storageRef(attrs.src, ownerId, workId)) throw new Error("Chapter images must use an image uploaded to this story.");
        if (typeof attrs.alt !== "string" || attrs.alt.length > 300 || typeof attrs.caption !== "string" || attrs.caption.length > 500) throw new Error("Add valid image text and caption details.");
        if (attrs.width !== undefined && (typeof attrs.width !== "number" || attrs.width < 15 || attrs.width > 100)) throw new Error("The image width is out of range.");
        if (attrs.align !== undefined && !["left", "center", "right"].includes(String(attrs.align))) throw new Error("The image alignment is invalid.");
      }
      output.attrs = current.type === "imageBlock" ? { src: attrs.src, alt: attrs.alt, caption: attrs.caption, width: attrs.width ?? 100, align: attrs.align ?? "center" } : current.type === "heading" || current.type === "paragraph" ? { ...(attrs.level === undefined ? {} : { level: attrs.level }), ...(attrs.textAlign === undefined ? {} : { textAlign: attrs.textAlign }), ...(attrs.indent === undefined ? {} : { indent: attrs.indent }) } : current.type === "literaryBlock" ? { treatment: attrs.treatment, ...(attrs.indent === undefined ? {} : { indent: attrs.indent }) } : {};
    }
    if (current.marks !== undefined) {
      if (!Array.isArray(current.marks) || current.marks.length > 10) throw new Error("The chapter formatting is invalid.");
      if (current.type !== "text") throw new Error("Text formatting can only be applied to words.");
      output.marks = current.marks.map((raw) => {
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("The chapter formatting is invalid.");
        const mark = raw as Record<string, unknown>;
        if (typeof mark.type !== "string" || !allowedMarks.has(mark.type)) throw new Error("The chapter contains an unsupported format.");
        if (mark.type === "link") {
          const attrs = mark.attrs as Record<string, unknown> | undefined;
          const href = attrs?.href;
          if (!safeLink(href)) throw new Error("The chapter link is invalid.");
          return { type: "link", attrs: { href } };
        }
        if (mark.type === "highlight") {
          const attrs = mark.attrs as Record<string, unknown> | undefined;
          return { type: "highlight", ...(attrs?.color && textStyleSchema.shape.color.safeParse(attrs.color).success ? { attrs: { color: attrs.color } } : {}) };
        }
        if (mark.type === "textStyle") {
          const attrs = textStyleSchema.safeParse(mark.attrs ?? {});
          if (!attrs.success) throw new Error("The chapter text style is invalid.");
          return { type: "textStyle", attrs: attrs.data };
        }
        return { type: mark.type };
      });
    }
    if (current.content !== undefined) {
      if (!Array.isArray(current.content) || current.content.length > 2000) throw new Error("The chapter structure is invalid.");
      output.content = current.content.map((child) => walk(child, depth + 1));
    }
    if (["doc", "paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "codeBlock", "literaryBlock"].includes(current.type) && !Array.isArray(current.content)) throw new Error("A chapter section is missing its content.");
    const children = output.content ?? [];
    if (current.type === "doc" && children.some((child) => !blockNodes.has(child.type))) throw new Error("Chapter pages can contain story blocks only.");
    if (["paragraph", "heading", "codeBlock"].includes(current.type) && children.some((child) => !inlineNodes.has(child.type))) throw new Error("Text sections may contain text and line breaks only.");
    if (["bulletList", "orderedList"].includes(current.type) && children.some((child) => child.type !== "listItem")) throw new Error("Lists must contain list items.");
    if (current.type === "listItem" && children.some((child) => !blockNodes.has(child.type) || ["bulletList", "orderedList", "imageBlock"].includes(child.type))) throw new Error("List item structure is invalid.");
    if (["blockquote", "literaryBlock"].includes(current.type) && children.some((child) => !blockNodes.has(child.type))) throw new Error("Literary blocks must contain story blocks.");
    if (["text", "hardBreak", "horizontalRule", "imageBlock"].includes(current.type) && current.content !== undefined) throw new Error("This story element cannot contain nested content.");
    return output;
  };
  const document = walk(input, 0) as RichDocument;
  const plainText = plainTextFromRichDocument(document);
  if (!plainText.trim()) throw new Error("Write some chapter text before saving.");
  if (plainText.length > 100_000) throw new Error("Chapter text must be 100,000 characters or fewer.");
  return { document, plainText };
}

export function toRichContent(document: RichDocument) { return { type: "rich" as const, document }; }
