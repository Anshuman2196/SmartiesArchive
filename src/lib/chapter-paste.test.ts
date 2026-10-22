import test from "node:test";
import assert from "node:assert/strict";
import { normalizeChapterPaste } from "./chapter-paste.ts";
import { validateRichDocument } from "./rich-document.ts";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Fragment, Slice } from "@tiptap/pm/model";

const owner = "11111111-1111-4111-8111-111111111111";
const work = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

test("paste preserves indentation, repeated spaces, and blank lines", () => {
  const source = "  First  line\r\n\r\n\tSecond\u00a0line  \r\n";
  assert.equal(normalizeChapterPaste(source), "  First  line\n\n\tSecond\u00a0line  \n");
});

test("long copied prose retains every line break and passes save validation", () => {
  const source = Array.from({ length: 3000 }, (_, index) => `Line  ${index + 1}`).join("\r\n");
  const lines = normalizeChapterPaste(source).split("\n");
  const content = lines.flatMap((line, index) => [...(index ? [{ type: "hardBreak" }] : []), { type: "text", text: line }]);
  const result = validateRichDocument({ type: "doc", content: [{ type: "paragraph", content }] }, owner, work);
  assert.equal(result.document.content[0].content?.filter((node) => node.type === "hardBreak").length, 2999);
  assert.match(result.plainText, /Line  1\nLine  2/);
});

test("preserved paste inserts into an existing TipTap chapter", () => {
  const editor = new Editor({ extensions: [StarterKit], content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Opening scene." }] }] } });
  try {
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    const lines = normalizeChapterPaste("  First  line\n\nSecond line. ").split("\n");
    editor.commands.command(({ tr, dispatch }) => {
      const content = lines.flatMap((line, index) => [
        ...(index ? [editor.schema.nodes.hardBreak.create()] : []),
        ...(line ? [editor.schema.text(line)] : []),
      ]);
      dispatch?.(tr.replaceSelection(new Slice(Fragment.from(editor.schema.nodes.paragraph.create(null, content)), 0, 0)));
      return true;
    });
    const result = validateRichDocument(editor.getJSON(), owner, work);
    assert.match(result.plainText, /First  line\n\nSecond line/);
    assert.equal(result.document.content.some((node) => node.content?.some((child) => child.text?.startsWith("  First  "))), true);
  } finally { editor.destroy(); }
});
