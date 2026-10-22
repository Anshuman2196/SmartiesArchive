import { z } from "zod";

export const literaryTreatments = ["narration", "dialogue", "thought", "whisper", "letter", "system", "caption", "glitch", "emphasis", "important", "callout"] as const;
export type LiteraryTreatment = (typeof literaryTreatments)[number];

export type RichNode = { type: string; attrs?: Record<string, unknown>; text?: string; marks?: Array<{ type: string; attrs?: Record<string, unknown> }>; content?: RichNode[] };
export type RichDocument = { type: "doc"; content: RichNode[] };
export const chapterContentLimits = { text: 100_000, json: 750_000, nodes: 12_000, children: 6000 } as const;

const allowedNodes = new Set(["doc", "paragraph", "heading", "text", "bulletList", "orderedList", "listItem", "taskList", "taskItem", "table", "tableRow", "tableCell", "tableHeader", "blockquote", "horizontalRule", "codeBlock", "hardBreak", "literaryBlock", "imageBlock"]);
const allowedMarks = new Set(["bold", "italic", "underline", "strike", "code", "highlight", "textStyle", "link", "superscript", "subscript", "spoiler"]);
const blockNodes = new Set(["paragraph", "heading", "bulletList", "orderedList", "taskList", "table", "blockquote", "horizontalRule", "codeBlock", "literaryBlock", "imageBlock"]);
const inlineNodes = new Set(["text", "hardBreak"]);
const textStyleSchema = z.object({ color: z.string().regex(/^#[\da-f]{3}(?:[\da-f]{3})?$/i).nullable().optional(), backgroundColor: z.string().regex(/^#[\da-f]{3}(?:[\da-f]{3})?$/i).nullable().optional(), fontFamily: z.enum(["Georgia", "Palatino", "Arial", "Verdana", "Courier New"]).nullable().optional(), fontSize: z.string().regex(/^(1[2-9]|[2-4]\d)px$/).nullable().optional() }).strict();
const safeLink = (href: unknown) => typeof href === "string" && !/[\\\u0000-\u001f]/.test(href) && (href.startsWith("/") && !href.startsWith("//") || /^(https?:|mailto:)/i.test(href));
const storageRef = (value: unknown, ownerId: string, workId: string) => typeof value === "string" && new RegExp(`^storage://story-media/${ownerId}/${workId}/[a-f0-9-]{36}\\.(?:png|jpe?g|webp|gif)$`, "i").test(value);

export type RichDocumentDiagnostic = { rule: string; path: string; nodeType?: string; markType?: string; attribute?: string };
export class RichDocumentValidationError extends Error {
  readonly diagnostic: RichDocumentDiagnostic;
  constructor(diagnostic: RichDocumentDiagnostic) {
    super("The chapter formatting needs attention.");
    this.name = "RichDocumentValidationError";
    this.diagnostic = diagnostic;
  }
}
export function safeRichDocumentErrorMessage(error: RichDocumentValidationError): string {
  const labels: Record<string, string> = { level: "heading level", indent: "paragraph indentation", textAlign: "paragraph alignment", treatment: "literary style", src: "image source", alt: "image description", caption: "image caption", width: "image width", align: "image alignment", href: "link address", color: "text color", backgroundColor: "highlight color", fontFamily: "font family", fontSize: "font size", start: "list numbering", language: "code language" };
  const field = error.diagnostic.attribute ? labels[error.diagnostic.attribute] : undefined;
  if (error.diagnostic.rule === "invalid_image_reference") return "This image is not attached to this story. Reinsert it from the story image picker; your other writing remains open.";
  if (error.diagnostic.rule === "empty_document") return "Add some chapter text before saving. Your current draft is still in the editor.";
  if (field) return `Check the ${field}. Your chapter is still open in the editor; correct it or download a recovery copy.`;
  if (error.diagnostic.rule === "invalid_text_style_attrs" && error.diagnostic.attribute && /^[a-z][a-zA-Z0-9_]{0,31}$/.test(error.diagnostic.attribute)) {
    return `The text style field “${error.diagnostic.attribute}” is not supported. Your text remains open; download a recovery copy before trying again.`;
  }
  const reasons: Record<string, string> = {
    invalid_document_root: "The document structure is incomplete.", document_size_limit: "The document is larger than the supported save limit.",
    invalid_node_shape: "An element has an incomplete structure.", unsupported_node: "An element uses a format this editor cannot save.",
    invalid_text_node: "A text element is not valid.", text_on_non_text_node: "An element has text in an unsupported place.",
    invalid_attrs_object: "An element has invalid formatting settings.", invalid_marks_array: "A text element has too many formatting styles.",
    marks_on_non_text_node: "A text style is attached to an element that cannot use text formatting.", invalid_mark_shape: "A text style has incomplete settings.",
    unsupported_mark: "A text style is not supported by this editor.", invalid_text_style_attrs: "A text style setting is not supported.",
    invalid_content_array: "An element's nested content is malformed.", missing_node_content: "An element is missing its content structure.",
    invalid_document_child: "The document contains an unsupported top-level element.", invalid_inline_child: "A text block contains a block element where text is expected.",
    invalid_list_child: "A list contains an invalid item.", invalid_list_item_child: "A list item contains an unsupported element.",
    invalid_block_child: "A literary block contains an unsupported element.", content_on_leaf_node: "A standalone element contains unexpected nested content.",
    plain_text_size_limit: "The chapter exceeds the supported text length.",
  };
  const reason = reasons[error.diagnostic.rule] ?? "One chapter element could not be saved.";
  return `${reason} Your full document is still open. Download a recovery copy before trying again.`;
}
function reject(rule: string, path: string, nodeType?: string, attribute?: string, markType?: string): never {
  throw new RichDocumentValidationError({ rule, path, ...(nodeType ? { nodeType } : {}), ...(attribute ? { attribute } : {}), ...(markType ? { markType } : {}) });
}

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
    if (["tableCell", "tableHeader"].includes(node.type)) output.push("\t");
    if (node.type === "tableRow") output.push("\n");
    if (["paragraph", "heading", "literaryBlock", "blockquote", "listItem", "taskItem"].includes(node.type)) output.push("\n\n");
  };
  walk(document);
  return output.join("").trim();
}

export function validateRichDocument(input: unknown, ownerId: string, workId: string): { document: RichDocument; plainText: string } {
  const parsed = z.record(z.string(), z.unknown()).safeParse(input);
  if (!parsed.success || parsed.data.type !== "doc" || !Array.isArray(parsed.data.content)) reject("invalid_document_root", "doc");
  if (JSON.stringify(input).length > chapterContentLimits.json) reject("document_size_limit", "doc");
  let nodeCount = 0;
  const walk = (node: unknown, depth: number, path: string): RichNode => {
    if (depth > 40 || ++nodeCount > chapterContentLimits.nodes || typeof node !== "object" || node === null || Array.isArray(node)) reject("invalid_node_shape", path);
    const current = node as Record<string, unknown>;
    if (typeof current.type !== "string" || !allowedNodes.has(current.type)) reject("unsupported_node", path, typeof current.type === "string" ? current.type : undefined);
    const nodeType = current.type;
    const output: RichNode = { type: nodeType };
    if (nodeType === "text") {
      if (typeof current.text !== "string" || current.text.length > 20_000) reject("invalid_text_node", path, nodeType, "text");
      output.text = current.text;
    } else if (current.text !== undefined) reject("text_on_non_text_node", path, nodeType, "text");

    let attrs: Record<string, unknown> = {};
    if (current.attrs !== undefined && current.attrs !== null) {
      // Older/editor-normalized payloads can carry a non-object attrs container.
      // It has no named schema attributes to preserve; use node defaults, then
      // validate every meaningful attribute below (images still require a safe src).
      if (typeof current.attrs === "object" && !Array.isArray(current.attrs)) attrs = current.attrs as Record<string, unknown>;
    }
    const headingLevel = attrs.level ?? 1;
    const literaryTreatment = attrs.treatment ?? "narration";
    if (nodeType === "heading" && ![1, 2, 3, 4, 5, 6].includes(Number(headingLevel))) reject("invalid_heading_level", path, nodeType, "level");
    const indent = attrs.indent;
    if (["paragraph", "heading", "literaryBlock"].includes(nodeType) && indent != null && (!Number.isInteger(indent) || Number(indent) < 0 || Number(indent) > 4)) reject("invalid_indent", path, nodeType, "indent");
    const textAlign = attrs.textAlign;
    if (["paragraph", "heading"].includes(nodeType) && textAlign != null && !["left", "center", "right", "justify"].includes(String(textAlign))) reject("invalid_alignment", path, nodeType, "textAlign");
    if (nodeType === "literaryBlock" && !literaryTreatments.includes(literaryTreatment as LiteraryTreatment)) reject("invalid_literary_treatment", path, nodeType, "treatment");
    if (nodeType === "imageBlock") {
      if (!storageRef(attrs.src, ownerId, workId)) reject("invalid_image_reference", path, nodeType, "src");
      if (typeof attrs.alt !== "string" || attrs.alt.length > 300) reject("invalid_image_alt", path, nodeType, "alt");
      if (typeof attrs.caption !== "string" || attrs.caption.length > 500) reject("invalid_image_caption", path, nodeType, "caption");
      if (attrs.width !== undefined && (typeof attrs.width !== "number" || !Number.isFinite(attrs.width) || attrs.width < 15 || attrs.width > 100)) reject("invalid_image_width", path, nodeType, "width");
      if (attrs.align !== undefined && !["left", "center", "right"].includes(String(attrs.align))) reject("invalid_image_alignment", path, nodeType, "align");
    }
    if (nodeType === "orderedList" && attrs.start != null && (!Number.isInteger(attrs.start) || Number(attrs.start) < 1 || Number(attrs.start) > 100_000)) reject("invalid_list_start", path, nodeType, "start");
    if (nodeType === "codeBlock" && attrs.language != null && (typeof attrs.language !== "string" || !/^[a-z\d_+#.-]{1,40}$/i.test(attrs.language))) reject("invalid_code_language", path, nodeType, "language");
    if (nodeType === "taskItem" && typeof attrs.checked !== "boolean") reject("invalid_task_state", path, nodeType, "checked");
    if (["tableCell", "tableHeader"].includes(nodeType) && attrs.align != null && !["left", "center", "right"].includes(String(attrs.align))) reject("invalid_table_alignment", path, nodeType, "align");

    if (Object.keys(attrs).length || nodeType === "heading" || nodeType === "literaryBlock") {
      output.attrs = nodeType === "imageBlock" ? { src: attrs.src, alt: attrs.alt, caption: attrs.caption, width: attrs.width ?? 100, align: attrs.align ?? "center" }
        : nodeType === "heading" || nodeType === "paragraph" ? { ...(nodeType === "heading" ? { level: headingLevel } : {}), ...(textAlign != null ? { textAlign } : {}), ...(indent != null ? { indent } : {}) }
          : nodeType === "literaryBlock" ? { treatment: literaryTreatment, ...(indent != null ? { indent } : {}) }
            : nodeType === "orderedList" ? { ...(attrs.start != null ? { start: attrs.start } : {}) }
              : nodeType === "codeBlock" ? { ...(attrs.language != null ? { language: attrs.language } : {}) }
                : nodeType === "taskItem" ? { checked: attrs.checked }
                  : ["tableCell", "tableHeader"].includes(nodeType) ? { ...(attrs.align != null ? { align: attrs.align } : {}) } : {};
      if (!Object.keys(output.attrs).length) delete output.attrs;
    }

    if (current.marks !== undefined) {
      if (!Array.isArray(current.marks) || current.marks.length > 12) reject("invalid_marks_array", path, nodeType, "marks");
      if (nodeType !== "text") reject("marks_on_non_text_node", path, nodeType, "marks");
      output.marks = current.marks.map((raw, markIndex) => {
        const markPath = `${path}.marks[${markIndex}]`;
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) reject("invalid_mark_shape", markPath, nodeType);
        const mark = raw as Record<string, unknown>;
        if (typeof mark.type !== "string" || !allowedMarks.has(mark.type)) reject("unsupported_mark", markPath, nodeType, undefined, typeof mark.type === "string" ? mark.type : undefined);
        if (mark.type === "link") {
          const markAttrs = mark.attrs;
          const href = typeof markAttrs === "object" && markAttrs !== null && !Array.isArray(markAttrs) ? (markAttrs as Record<string, unknown>).href : undefined;
          if (!safeLink(href)) reject("invalid_link_href", markPath, nodeType, "href", mark.type);
          return { type: "link", attrs: { href } };
        }
        if (mark.type === "highlight") {
          const markAttrs = mark.attrs;
          const color = typeof markAttrs === "object" && markAttrs !== null && !Array.isArray(markAttrs) ? (markAttrs as Record<string, unknown>).color : undefined;
          if (color != null && !textStyleSchema.shape.color.safeParse(color).success) reject("invalid_highlight_color", markPath, nodeType, "color", mark.type);
          return { type: "highlight", ...(typeof color === "string" ? { attrs: { color } } : {}) };
        }
        if (mark.type === "textStyle") {
          const parsedAttrs = textStyleSchema.safeParse(mark.attrs ?? {});
          if (!parsedAttrs.success) {
            const issue = parsedAttrs.error.issues[0];
            const issueField = typeof issue?.path[0] === "string" ? issue.path[0] : issue?.code === "unrecognized_keys" ? issue.keys[0] : undefined;
            reject("invalid_text_style_attrs", markPath, nodeType, issueField ?? "attrs", mark.type);
          }
          const normalized = Object.fromEntries(Object.entries(parsedAttrs.data).filter(([, value]) => value != null));
          return { type: "textStyle", ...(Object.keys(normalized).length ? { attrs: normalized } : {}) };
        }
        return { type: mark.type };
      });
    }
    if (current.content !== undefined) {
      if (!Array.isArray(current.content) || current.content.length > chapterContentLimits.children) reject("invalid_content_array", path, nodeType, "content");
      output.content = current.content.map((child, index) => walk(child, depth + 1, `${path}.content[${index}]`));
    } else if (["paragraph", "heading"].includes(nodeType)) {
      // ProseMirror/TipTap JSON may omit `content` on an empty text block.
      // Canonicalize it to [] so a trailing blank line survives validation,
      // save/reload, preview, and publish without weakening container checks.
      output.content = [];
    }
    if (["doc", "bulletList", "orderedList", "listItem", "taskList", "taskItem", "table", "tableRow", "tableCell", "tableHeader", "blockquote", "codeBlock", "literaryBlock"].includes(nodeType) && !Array.isArray(current.content)) reject("missing_node_content", path, nodeType, "content");
    const children = output.content ?? [];
    if (nodeType === "doc" && children.some((child) => !blockNodes.has(child.type))) reject("invalid_document_child", path, nodeType, "content");
    if (["paragraph", "heading", "codeBlock"].includes(nodeType) && children.some((child) => !inlineNodes.has(child.type))) reject("invalid_inline_child", path, nodeType, "content");
    if (["bulletList", "orderedList"].includes(nodeType) && children.some((child) => child.type !== "listItem")) reject("invalid_list_child", path, nodeType, "content");
    if (nodeType === "taskList" && children.some((child) => child.type !== "taskItem")) reject("invalid_list_child", path, nodeType, "content");
    if (nodeType === "taskItem" && children.some((child) => !["paragraph", "taskList"].includes(child.type))) reject("invalid_list_item_child", path, nodeType, "content");
    if (nodeType === "table" && children.some((child) => child.type !== "tableRow")) reject("invalid_table_child", path, nodeType, "content");
    if (nodeType === "tableRow" && children.some((child) => !["tableCell", "tableHeader"].includes(child.type))) reject("invalid_table_child", path, nodeType, "content");
    if (["tableCell", "tableHeader"].includes(nodeType) && children.some((child) => child.type !== "paragraph")) reject("invalid_table_child", path, nodeType, "content");
    if (nodeType === "listItem" && children.some((child) => !blockNodes.has(child.type) || ["bulletList", "orderedList", "imageBlock"].includes(child.type))) reject("invalid_list_item_child", path, nodeType, "content");
    if (["blockquote", "literaryBlock"].includes(nodeType) && children.some((child) => !blockNodes.has(child.type))) reject("invalid_block_child", path, nodeType, "content");
    if (["text", "hardBreak", "horizontalRule", "imageBlock"].includes(nodeType) && current.content !== undefined) reject("content_on_leaf_node", path, nodeType, "content");
    return output;
  };
  const document = walk(input, 0, "doc") as RichDocument;
  const plainText = plainTextFromRichDocument(document);
  if (!plainText.trim()) reject("empty_document", "doc");
  if (plainText.length > chapterContentLimits.text) reject("plain_text_size_limit", "doc");
  return { document, plainText };
}

export function toRichContent(document: RichDocument) { return { type: "rich" as const, document }; }
