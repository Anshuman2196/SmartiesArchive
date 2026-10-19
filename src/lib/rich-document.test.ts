import test from "node:test";
import assert from "node:assert/strict";
import { legacyTextToRichDocument, safeRichDocumentErrorMessage, toRichContent, validateRichDocument } from "./rich-document.ts";
import { normalizeReaderContent } from "./chapter-content.ts";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import { richMarkTag, richNodeTag } from "./rich-rendering.ts";

const owner = "11111111-1111-4111-8111-111111111111";
const work = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const asset = `storage://story-media/${owner}/${work}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1.webp`;
const assertRejectedBy = (input: unknown, rule: string) => assert.throws(() => validateRichDocument(input, owner, work), (error: unknown) => {
  assert.equal((error as { diagnostic?: { rule?: string } }).diagnostic?.rule, rule);
  return true;
});

test("legacy prose converts to editable paragraphs without touching stored rows", () => {
  assert.deepEqual(legacyTextToRichDocument("First line\n\nSecond line"), {
    type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "First line" }] },
      { type: "paragraph", content: [{ type: "text", text: "Second line" }] },
    ],
  });
});

test("rich document validation preserves allowed formatting and image placement", () => {
  const document = { type: "doc", content: [
    { type: "heading", attrs: { level: 2, textAlign: "center", indent: 1 }, content: [{ type: "text", text: "The letter", marks: [{ type: "bold" }, { type: "textStyle", attrs: { fontSize: "28px", fontFamily: "Palatino", color: "#cc3344" } }] }] },
    { type: "paragraph", content: [{ type: "text", text: "Before the image." }] },
    { type: "imageBlock", attrs: { src: asset, previewSrc: "https://signed.example/temporary", alt: "A candlelit desk", caption: "Midnight, 1894", width: 72, align: "right" } },
    { type: "literaryBlock", attrs: { treatment: "whisper", indent: 1 }, content: [{ type: "paragraph", content: [{ type: "text", text: "Come closer." }] }] },
  ] };
  const result = validateRichDocument(document, owner, work);
  assert.equal(result.document.content[0].attrs?.indent, 1);
  assert.equal(result.document.content[0].content?.[0].marks?.[1].attrs?.fontSize, "28px");
  assert.equal(result.document.content[2].attrs?.src, asset);
  assert.equal(result.document.content[2].attrs?.previewSrc, undefined);
  assert.equal(result.document.content[2].attrs?.caption, "Midnight, 1894");
  assert.match(result.plainText, /Before the image/);
  assert.match(result.plainText, /Midnight, 1894/);
});

test("TipTap v3 null defaults round-trip text styles, alignment, heading, and indentation", () => {
  const tiptapDocument = { type: "doc", content: [
    { type: "heading", attrs: { level: 2, textAlign: null, indent: 0 }, content: [{ type: "text", text: "A heading", marks: [{ type: "textStyle", attrs: { color: "#4169e1", backgroundColor: null, fontFamily: null, fontSize: null } }] }] },
    { type: "paragraph", attrs: { textAlign: null, indent: 0 }, content: [{ type: "text", text: "Unstyled text stays plain." }] },
  ] };
  const validated = validateRichDocument(tiptapDocument, owner, work);
  assert.deepEqual(validated.document.content[0].attrs, { level: 2, indent: 0 });
  assert.deepEqual(validated.document.content[0].content?.[0].marks?.[0], { type: "textStyle", attrs: { color: "#4169e1" } });

  const serialized = JSON.stringify(toRichContent(validated.document));
  const reloaded = normalizeReaderContent(JSON.parse(serialized), validated.plainText, owner, work);
  assert.equal(reloaded.type, "rich");
  if (reloaded.type === "rich") assert.deepEqual(reloaded.document, validated.document);
});

test("real TipTap JSON with default null attrs and a color mark passes server validation", () => {
  const editor = new Editor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } }), TextAlign.configure({ types: ["heading", "paragraph"] }), TextStyleKit.configure({ lineHeight: false }), Highlight.configure({ multicolor: true }), Superscript, Subscript],
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "A color sample" }] }, { type: "paragraph", content: [{ type: "text", text: "An aligned sample" }] }] },
  });
  try {
    editor.chain().selectAll().setColor("#4169e1").run();
    editor.chain().setTextSelection(2).setTextAlign("center").run();
    const actualTipTapJson = editor.getJSON();
    assert.equal((actualTipTapJson.content?.[0] as { attrs?: { textAlign?: unknown } }).attrs?.textAlign, "center");
    assert.equal((actualTipTapJson.content?.[1] as { attrs?: { textAlign?: unknown } }).attrs?.textAlign, null);
    assert.doesNotThrow(() => validateRichDocument(actualTipTapJson, owner, work));
  } finally { editor.destroy(); }
});

test("malformed mark attributes return a safe rule and path without retaining text", () => {
  const input = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "private writing here", marks: [{ type: "textStyle", attrs: { fontSize: "999px" } }] }] }] };
  assert.throws(() => validateRichDocument(input, owner, work), (error: unknown) => {
    assert.equal((error as Error).message, "The chapter formatting needs attention.");
    assert.deepEqual((error as { diagnostic?: unknown }).diagnostic, { rule: "invalid_text_style_attrs", path: "doc.content[0].content[0].marks[0]", nodeType: "text", attribute: "fontSize", markType: "textStyle" });
    assert.equal(JSON.stringify(error).includes("private writing here"), false);
    return true;
  });
});

test("validation feedback identifies a safe formatting target without revealing chapter text", () => {
  let caught: unknown;
  try { validateRichDocument({ type: "doc", content: [{ type: "imageBlock", attrs: { src: asset, alt: "private image description", caption: "private caption", width: 101 } }] }, owner, work); }
  catch (error) { caught = error; }
  assert.ok(caught instanceof Error);
  const message = safeRichDocumentErrorMessage(caught as Parameters<typeof safeRichDocumentErrorMessage>[0]);
  assert.match(message, /image width near item 1/);
  assert.match(message, /download a recovery copy/);
  assert.doesNotMatch(message, /private image description|private caption|101/);
});

test("structural validation feedback names the failed rule and safe document position", () => {
  let caught: unknown;
  try { validateRichDocument({ type: "doc", content: [{ type: "paragraph", content: [{ type: "bulletList", content: [] }] }] }, owner, work); }
  catch (error) { caught = error; }
  assert.ok(caught instanceof Error);
  const message = safeRichDocumentErrorMessage(caught as Parameters<typeof safeRichDocumentErrorMessage>[0]);
  assert.match(message, /text block contains a block element where text is expected/);
  assert.match(message, /invalid_inline_child near item 1/);
  assert.doesNotMatch(message, /secret|chapter text/);
});

test("all editor node and mark types survive save, reload, preview data, and publish payload validation", () => {
  const doc = { type: "doc", content: [
    { type: "paragraph", attrs: { textAlign: "center", indent: 1 }, content: [{ type: "text", text: "Styled 🙂 text", marks: [
      { type: "bold" }, { type: "italic" }, { type: "underline" }, { type: "strike" }, { type: "code" },
      { type: "highlight", attrs: { color: "#d4f36a" } },
      { type: "textStyle", attrs: { color: "#4169e1", backgroundColor: "#151a28", fontFamily: "Georgia", fontSize: "22px" } },
      { type: "link", attrs: { href: "/work/story/chapter/next" } }, { type: "superscript" }, { type: "subscript" },
    ] }, { type: "hardBreak" }, { type: "text", text: "after the break" }] },
    { type: "heading", attrs: { level: 1, textAlign: null, indent: 0 }, content: [{ type: "text", text: "Heading" }] },
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "bullet" }] }] }] },
    { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "ordered" }] }] }] },
    { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "quoted" }] }] },
    { type: "horizontalRule" },
    { type: "codeBlock", attrs: { language: "typescript" }, content: [{ type: "text", text: "const page = 1" }] },
    { type: "literaryBlock", attrs: { treatment: "letter" }, content: [{ type: "paragraph", content: [{ type: "text", text: "Dear reader" }] }] },
    { type: "imageBlock", attrs: { src: asset, alt: "A desk", caption: "At dusk", width: 68, align: "left" } },
  ] };
  const saved = validateRichDocument(doc, owner, work);
  const savedPayload = JSON.stringify(toRichContent(saved.document));
  const reloaded = normalizeReaderContent(JSON.parse(savedPayload), saved.plainText, owner, work);
  assert.equal(reloaded.type, "rich");
  if (reloaded.type !== "rich") return;
  const publishPayload = validateRichDocument(reloaded.document, owner, work).document;
  assert.deepEqual(publishPayload, saved.document);
  assert.equal(publishPayload.content[3].attrs?.start, 3);
  assert.equal(publishPayload.content[6].attrs?.language, "typescript");
  assert.match(saved.plainText, /Styled 🙂 text/);
  assert.equal(publishPayload.content.at(-1)?.attrs?.caption, "At dusk");
});

test("reader renderer maps every supported document node and mark to a semantic element", () => {
  const nodeTags: Record<string, string> = { doc: "div", paragraph: "p", heading: "h2", text: "span", bulletList: "ul", orderedList: "ol", listItem: "li", blockquote: "blockquote", horizontalRule: "hr", codeBlock: "pre", hardBreak: "br", literaryBlock: "section", imageBlock: "figure" };
  for (const [type, tag] of Object.entries(nodeTags)) assert.equal(richNodeTag({ type, attrs: type === "heading" ? { level: 2 } : undefined }), tag, `node ${type}`);
  const markTags: Record<string, string> = { bold: "strong", italic: "em", underline: "u", strike: "s", code: "code", highlight: "mark", textStyle: "span", link: "a", superscript: "sup", subscript: "sub" };
  for (const [type, tag] of Object.entries(markTags)) assert.equal(richMarkTag(type), tag, `mark ${type}`);
});

test("rich documents reject executable elements, unsafe links, and foreign media paths", () => {
  assertRejectedBy({ type: "doc", content: [{ type: "html", attrs: { html: "<script>run()</script>" } }] }, "unsupported_node");
  assertRejectedBy({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }] }, "invalid_link_href");
  assertRejectedBy({ type: "doc", content: [{ type: "imageBlock", attrs: { src: asset.replace(work, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"), alt: "x", caption: "" } }] }, "invalid_image_reference");
  assertRejectedBy({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "textStyle", attrs: { fontFamily: "url(javascript:alert(1))" } }] }] }] }, "invalid_text_style_attrs");
  assertRejectedBy({ type: "doc", content: [{ type: "imageBlock", attrs: { src: "https://untrusted.example/image.png", alt: "x", caption: "" } }] }, "invalid_image_reference");
});
