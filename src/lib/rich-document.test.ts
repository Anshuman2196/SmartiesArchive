import test from "node:test";
import assert from "node:assert/strict";
import { legacyTextToRichDocument, validateRichDocument } from "./rich-document.ts";

const owner = "11111111-1111-4111-8111-111111111111";
const work = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const asset = `storage://story-media/${owner}/${work}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1.webp`;

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

test("rich documents reject executable elements, unsafe links, and foreign media paths", () => {
  assert.throws(() => validateRichDocument({ type: "doc", content: [{ type: "html", attrs: { html: "<script>run()</script>" } }] }, owner, work), /unsupported element/i);
  assert.throws(() => validateRichDocument({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }] }, owner, work), /link is invalid/i);
  assert.throws(() => validateRichDocument({ type: "doc", content: [{ type: "imageBlock", attrs: { src: asset.replace(work, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"), alt: "x", caption: "" } }] }, owner, work), /uploaded to this story/i);
  assert.throws(() => validateRichDocument({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "textStyle", attrs: { fontFamily: "url(javascript:alert(1))" } }] }] }] }, owner, work), /text style is invalid/i);
  assert.throws(() => validateRichDocument({ type: "doc", content: [{ type: "imageBlock", attrs: { src: "https://untrusted.example/image.png", alt: "x", caption: "" } }] }, owner, work), /uploaded to this story/i);
});
