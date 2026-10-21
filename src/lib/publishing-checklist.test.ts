import assert from "node:assert/strict";
import test from "node:test";
import { getPublishChecklist } from "./publishing-checklist.ts";

test("publish checklist distinguishes optional warnings from blockers", () => {
  const checklist = getPublishChecklist({
    chapters: [{ title: "Opening", state: "draft", body: "" }],
  });

  assert.deepEqual(checklist.map((item) => item.tone), ["warning", "warning", "blocking", "warning"]);
  assert.match(checklist[2].detail, /at least one chapter/);
  assert.match(checklist[3].detail, /missing content/);
});

test("published stories report ready metadata and pending revisions", () => {
  const checklist = getPublishChecklist({
    coverUrl: "storage://story-media/cover.webp",
    contentWarnings: ["Grief"],
    chapters: [
      { title: "Opening", state: "published", body: "Once.", hasDraft: true },
      { title: "Ending", state: "published", body: "At last." },
    ],
  });

  assert.deepEqual(checklist.map((item) => item.tone), ["ready", "ready", "ready", "warning"]);
  assert.match(checklist[3].detail, /unpublished/);
});
