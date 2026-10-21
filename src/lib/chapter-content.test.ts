import test from "node:test";
import assert from "node:assert/strict";
import { buildChapterContent, normalizeReaderContent } from "./chapter-content.ts";

test("chapter formats convert to structured, renderable payloads", () => {
  assert.deepEqual(buildChapterContent("prose", "First paragraph\n\nSecond." ).content, { type: "prose", text: "First paragraph\n\nSecond." });
  assert.deepEqual(buildChapterContent("chat", "Mira: Hello\nSol: Hi").content, { type: "chat", messages: [{ speaker: "Mira", text: "Hello" }, { speaker: "Sol", text: "Hi" }] });
  assert.deepEqual(buildChapterContent("comic", "https://cdn.example/panel.png | A quiet room").content, { type: "comic", panels: [{ url: "https://cdn.example/panel.png", alt: "A quiet room" }] });
  assert.deepEqual(buildChapterContent("image", "https://cdn.example/image.png", "Cover scene").content, { type: "image", url: "https://cdn.example/image.png", alt: "Cover scene" });
  assert.deepEqual(buildChapterContent("pdf", "storage://story-media/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/33333333-3333-3333-3333-333333333333.pdf").content, { type: "pdf", url: "storage://story-media/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/33333333-3333-3333-3333-333333333333.pdf" });
});

test("chapter media rejects insecure or malformed content", () => {
  assert.throws(() => buildChapterContent("image", "javascript:alert(1)"));
  assert.throws(() => buildChapterContent("comic", "http://cdn.example/panel.png"));
  assert.throws(() => buildChapterContent("chat", "A line without a speaker"), /Speaker: message/i);
  assert.throws(() => buildChapterContent("mixed", "not json"), /JSON array/i);
  assert.throws(() => buildChapterContent("pdf", "storage://story-media/not-a-valid-path.pdf"));
});

test("invalid stored payload falls back to escaped plain text rendering", () => {
  const result = normalizeReaderContent({ type: "html", html: "<script>bad</script>" }, "<script>shown as text</script>");
  assert.deepEqual(result, { type: "prose", text: "<script>shown as text</script>" });
});
