import test from "node:test";
import assert from "node:assert/strict";
import { countWords, formatReadingTime, readingMinutes } from "./reading-time.ts";

test("reading time rounds up at 220 words per minute", () => {
  assert.equal(countWords("  one two\nthree  "), 3);
  assert.equal(countWords(null), 0);
  assert.equal(readingMinutes(0), 0);
  assert.equal(readingMinutes(1), 1);
  assert.equal(readingMinutes(220), 1);
  assert.equal(readingMinutes(221), 2);
  assert.equal(readingMinutes(3300), 15);
});

test("reading time labels switch to hours past an hour", () => {
  assert.equal(formatReadingTime(0), "");
  assert.equal(formatReadingTime(37), "37 min read");
  assert.equal(formatReadingTime(60), "1 h read");
  assert.equal(formatReadingTime(65, { suffix: false }), "1 h 5 min");
});
