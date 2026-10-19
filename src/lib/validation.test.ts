import test from "node:test";
import assert from "node:assert/strict";
import { chapterSchema, registrationSchema, workSchema } from "./validation.ts";

test("registration requires a valid public profile and strong password", () => {
  assert.equal(registrationSchema.safeParse({ email: "reader@example.com", password: "long-enough-password", username: "reader_1", displayName: "Reader" }).success, true);
  assert.equal(registrationSchema.safeParse({ email: "bad", password: "short", username: "two", displayName: "" }).success, false);
});

test("works accept only the supported visibility modes", () => {
  assert.equal(workSchema.safeParse({ title: "A story", summary: "", visibility: "unlisted" }).success, true);
  assert.equal(workSchema.safeParse({ title: "", summary: "", visibility: "friends" }).success, false);
});

test("chapters reject empty content and unknown publication states", () => {
  assert.equal(chapterSchema.safeParse({ title: "First", content: "Once upon a time", publish: "published" }).success, true);
  assert.equal(chapterSchema.safeParse({ title: "First", content: " ", publish: "published" }).success, false);
});
