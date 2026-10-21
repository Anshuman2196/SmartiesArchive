import test from "node:test";
import assert from "node:assert/strict";
import { normalizeChapterPaste } from "./chapter-paste.ts";
import { validateRichDocument } from "./rich-document.ts";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Fragment, Slice } from "@tiptap/pm/model";

test("long prose paste drops empty lines and imported spacing characters before save", () => {
  const source = Array.from({ length: 800 }, (_, index) => `  Scene\u00a0${index + 1}\t continues here.  `).join("\r\n\r\n\r\n");
  const paragraphs = normalizeChapterPaste(source);
  assert.equal(paragraphs.length, 800);
  assert.equal(paragraphs[0], "Scene 1 continues here.");
  assert.equal(paragraphs.at(-1), "Scene 800 continues here.");

  const document = { type: "doc", content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })) };
  const result = validateRichDocument(document, "11111111-1111-4111-8111-111111111111", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1");
  assert.equal(result.document.content.length, 800);
  assert.match(result.plainText, /Scene 800 continues here/);
});

test("a long chapter with short paragraphs stays within supported save limits", () => {
  const paragraphs = normalizeChapterPaste(Array.from({ length: 3000 }, (_, index) => `Line ${index + 1} carries the story on.`).join("\n\n"));
  const document = { type: "doc", content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })) };
  const result = validateRichDocument(document, "11111111-1111-4111-8111-111111111111", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1");
  assert.equal(result.document.content.length, 3000);
  assert.ok(result.plainText.length < 100_000);
});

test("clean paragraphs insert into an existing TipTap chapter and remain saveable", () => {
  const editor = new Editor({ extensions: [StarterKit], content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Opening scene." }] }] } });
  try {
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    const paragraphs = normalizeChapterPaste("First pasted line.\n\n\nSecond pasted line.");
    editor.commands.command(({ tr, dispatch }) => {
      const nodes = paragraphs.map((text) => editor.schema.nodes.paragraph.create(null, editor.schema.text(text)));
      dispatch?.(tr.replaceSelection(new Slice(Fragment.fromArray(nodes), 0, 0)));
      return true;
    });
    const result = validateRichDocument(editor.getJSON(), "11111111-1111-4111-8111-111111111111", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1");
    assert.match(result.plainText, /Opening scene/);
    assert.match(result.plainText, /First pasted line/);
    assert.match(result.plainText, /Second pasted line/);
  } finally { editor.destroy(); }
});
