import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLiteraryTreatment } from "./literary-detection.ts";
import type { RichNode } from "./rich-document.ts";

const paragraph = (text: string): RichNode => ({ type: "paragraph", content: [{ type: "text", text }] });

test("detects clear dialogue and document cues", () => {
  assert.equal(detectLiteraryTreatment(paragraph("“Come in,” she said.")), "dialogue");
  assert.equal(detectLiteraryTreatment(paragraph("— Come in.")), "dialogue");
  assert.equal(detectLiteraryTreatment(paragraph("Dear Mara,")), "letter");
  assert.equal(detectLiteraryTreatment(paragraph("[SYSTEM] Door unlocked")), "system");
});

test("leaves prose and existing styles untouched", () => {
  assert.equal(detectLiteraryTreatment(paragraph("She said, “Come in,” and opened the door.")), null);
  assert.equal(detectLiteraryTreatment(paragraph("The hallway was quiet.")), null);
  assert.equal(detectLiteraryTreatment({ type: "literaryBlock", attrs: { treatment: "thought" }, content: [paragraph("“Come in.”")] }), null);
});
