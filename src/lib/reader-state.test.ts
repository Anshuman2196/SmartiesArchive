import test from "node:test";
import assert from "node:assert/strict";
import { defaultReaderPreferences, isSecureMediaUrl, normalizeReaderPreferences } from "./reader-state.ts";

test("reader settings are restored only within supported ranges", () => {
  assert.deepEqual(normalizeReaderPreferences(null), defaultReaderPreferences);
  assert.deepEqual(normalizeReaderPreferences({ theme: "sepia", font: "sans", size: 99, leading: 0.2, spacing: 99, width: 900 }), { theme: "sepia", font: "sans", size: 28, leading: 1.4, spacing: 2.5, width: 900 });
});

test("reader media URLs must use HTTPS", () => {
  assert.equal(isSecureMediaUrl("https://cdn.example/image.png"), true);
  assert.equal(isSecureMediaUrl("http://cdn.example/image.png"), false);
  assert.equal(isSecureMediaUrl("javascript:alert(1)"), false);
});
