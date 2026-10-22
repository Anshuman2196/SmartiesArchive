import test from "node:test";
import assert from "node:assert/strict";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TableKit } from "@tiptap/extension-table";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { expandInlineMarkdown, markdownRunsForPreview } from "./markdown-preview.ts";
import { validateRichDocument, type RichDocument } from "./rich-document.ts";

const owner = "11111111-1111-4111-8111-111111111111";
const work = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

test("typed Markdown becomes the same rich document used by preview and saving", () => {
  const raw: RichDocument = { type: "doc", content: [{ type: "paragraph", content: [
    { type: "text", text: "# Scene one" }, { type: "hardBreak" },
    { type: "text", text: "A **bold** moment." }, { type: "hardBreak" },
    { type: "text", text: "- [x] A task" },
  ] }] };
  const runs = markdownRunsForPreview(raw);
  assert.equal(runs.length, 1);
  const source = runs[0].source;
  const editor = new Editor({ extensions: [StarterKit, TableKit, TaskList, TaskItem, Markdown], content: raw });
  try {
    assert.ok(editor.markdown);
    editor.commands.setContent(editor.markdown.parse(source));
    const saved = validateRichDocument(editor.getJSON(), owner, work).document;
    assert.equal(saved.content[0].type, "heading");
    assert.equal(saved.content[1].content?.[1].marks?.[0].type, "bold");
    assert.equal(saved.content[2].type, "taskList");
  } finally { editor.destroy(); }
});

test("Markdown import preserves single newlines between dialogue lines", () => {
  const editor = new Editor({ extensions: [StarterKit, Markdown.configure({ markedOptions: { breaks: true } })], content: { type: "doc", content: [{ type: "paragraph" }] } });
  try {
    const parsed = editor.markdown!.parse('Marcus put the file aside. "I need to tell you."\n"What now?"');
    const saved = validateRichDocument(parsed, owner, work).document;
    assert.equal(saved.content.length, 1);
    assert.equal(saved.content[0].content?.[1].type, "hardBreak");
    assert.equal(saved.content[0].content?.[2].text, '"What now?"');
  } finally { editor.destroy(); }
});

test("ordinary prose and existing rich formatting keep their exact content", () => {
  const plain: RichDocument = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "  First  line" }, { type: "hardBreak" }, { type: "text", text: "Second line.  " }] }] };
  assert.deepEqual(markdownRunsForPreview(plain), []);
  assert.deepEqual(markdownRunsForPreview({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "**Already bold**", marks: [{ type: "bold" }] }] }] }), []);
});

test("Markdown after a formatted heading remains eligible for conversion", () => {
  const mixed: RichDocument = { type: "doc", content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Existing heading" }] },
    { type: "paragraph", content: [{ type: "text", text: "A **bold** moment." }] },
  ] };
  assert.deepEqual(markdownRunsForPreview(mixed), [{ start: 1, end: 2, source: "A **bold** moment." }]);
});

test("literal bold Markdown inside an existing styled block renders as bold without changing its block", () => {
  const raw: RichDocument = { type: "doc", content: [{ type: "literaryBlock", attrs: { treatment: "system" }, content: [{ type: "paragraph", content: [
    { type: "text", text: "**COMPOSITE WITHDRAWN — IDENTIFICATION UNRELIABLE.**" },
  ] }] }] };
  assert.deepEqual(markdownRunsForPreview(raw), []);
  const editor = new Editor({ extensions: [StarterKit, Markdown], content: raw.content[0].content?.[0] ?? { type: "paragraph" } });
  try {
    assert.ok(editor.markdown);
    const result = expandInlineMarkdown(raw, (source) => editor.markdown!.parse(source) as RichDocument);
    assert.equal(result.changed, true);
    assert.equal(result.document.content[0].type, "literaryBlock");
    const bold = result.document.content[0].content?.[0].content?.[0];
    assert.equal(bold?.text, "COMPOSITE WITHDRAWN — IDENTIFICATION UNRELIABLE.");
    assert.deepEqual(bold?.marks, [{ type: "bold" }]);
    assert.doesNotThrow(() => validateRichDocument(result.document, owner, work));
  } finally { editor.destroy(); }
});
