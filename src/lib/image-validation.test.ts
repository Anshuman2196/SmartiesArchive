import test from "node:test";
import assert from "node:assert/strict";
import { maxStoryImageBytes, storyImageExtension, validStoryImageHeader } from "./image-validation.ts";

test("image upload validation accepts supported signatures and assigns safe extensions", () => {
  assert.equal(storyImageExtension("image/webp"), "webp");
  assert.equal(validStoryImageHeader("image/png", 24, [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]), true);
  assert.equal(validStoryImageHeader("image/webp", 24, [0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50]), true);
});

test("image upload validation rejects mismatched type, invalid size, and malformed headers", () => {
  assert.equal(validStoryImageHeader("image/png", 24, [0xff,0xd8,0xff,0,0,0,0,0,0,0,0,0]), false);
  assert.equal(validStoryImageHeader("image/png", maxStoryImageBytes + 1, [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]), false);
  assert.equal(validStoryImageHeader("image/svg+xml", 12, new Array(12).fill(0)), false);
  assert.equal(validStoryImageHeader("image/gif", 12, [71,73,70]), false);
});
