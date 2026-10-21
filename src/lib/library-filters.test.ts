import test from "node:test";
import assert from "node:assert/strict";
import {
  getLibraryOptions,
  hasActiveLibraryFilters,
  matchesLibraryFilters,
  parseLibraryFilters,
  sortLibraryWorks,
  type LibraryWork,
} from "./library-filters.ts";

const works: LibraryWork[] = [
  {
    id: "one",
    title: "Moonlit Rooms",
    summary: "A quiet mystery.",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-02-01T00:00:00.000Z",
    tags: ["Mystery", "Slow burn"],
    content_warnings: ["Violence"],
    profiles: { username: "mira", display_name: "Mira Vale" },
  },
  {
    id: "two",
    title: "Paper Moons",
    summary: "A coming-of-age story.",
    created_at: "2026-02-01T00:00:00.000Z",
    updated_at: "2026-02-02T00:00:00.000Z",
    tags: ["Coming of age"],
    content_warnings: [],
    profiles: { username: "noor", display_name: "Noor Shah" },
  },
];

test("parses supported filters and falls back for unknown sort values", () => {
  assert.deepEqual(parseLibraryFilters({ q: " Mira ", tag: "Mystery", warning: "Violence", sort: "bad" }), {
    q: "Mira",
    tag: "Mystery",
    warning: "Violence",
    sort: "newest",
  });
  assert.equal(hasActiveLibraryFilters(parseLibraryFilters({})), false);
  assert.equal(hasActiveLibraryFilters(parseLibraryFilters({ sort: "title" })), true);
});

test("matches query text against title, author, summary, and tags", () => {
  assert.equal(matchesLibraryFilters(works[0], parseLibraryFilters({ q: "mira" })), true);
  assert.equal(matchesLibraryFilters(works[0], parseLibraryFilters({ q: "slow" })), true);
  assert.equal(matchesLibraryFilters(works[0], parseLibraryFilters({ q: "coming" })), false);
});

test("matches tags and warnings without case sensitivity", () => {
  assert.equal(matchesLibraryFilters(works[0], parseLibraryFilters({ tag: "mystery", warning: "violence" })), true);
  assert.equal(matchesLibraryFilters(works[1], parseLibraryFilters({ warning: "violence" })), false);
});

test("sorts without mutating the source collection", () => {
  assert.deepEqual(sortLibraryWorks(works, "oldest").map((work) => work.id), ["one", "two"]);
  assert.deepEqual(sortLibraryWorks(works, "updated").map((work) => work.id), ["two", "one"]);
  assert.deepEqual(sortLibraryWorks(works, "title").map((work) => work.id), ["one", "two"]);
  assert.deepEqual(works.map((work) => work.id), ["one", "two"]);
});

test("deduplicates filter options while preserving readable labels", () => {
  const options = getLibraryOptions([...works, { ...works[0], id: "three", tags: [" mystery "] }], "tags");
  assert.deepEqual(options, ["Coming of age", "Mystery", "Slow burn"]);
});
