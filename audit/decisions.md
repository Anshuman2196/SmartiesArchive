# Implementation Decisions

## Project scope

- This remains a private server library for roughly 20 users and a limited story collection.
- Discord integration, external search services, pagination infrastructure, offline reading, and enterprise moderation are out of scope.
- The existing Next.js, Supabase, TipTap, and handcrafted CSS stack is retained.
- Database migrations are committed to the repository, but applying them to the hosted Supabase project requires a connected account with migration permission.

## 2026-10-21 — Custom PDF manga support

- PDFs are chapter-level assets: one PDF is attached to one chapter.
- PDFs use a new `pdf` chapter format and are stored in the existing private `story-media` bucket.
- PDF uploads are capped at 50 MB. Existing image uploads remain capped at 8 MB.
- Storage references use `storage://story-media/<user>/<work>/<asset>.pdf`; the chapter route signs them only after Supabase access checks.
- The reader uses `pdfjs-dist@4.10.38` with a custom React canvas viewer instead of the browser-native PDF viewer, so the toolbar, themes, controls, and fallback behavior remain under app control.
- Pages are rendered lazily with `IntersectionObserver`; the viewer renders nearby pages and cleans up PDF loading/render tasks when unmounted.
- The viewer supports previous/next page controls, direct page entry, fit-width/actual-size mode, zoom, keyboard navigation, and download/open fallback.
- No PDF-to-image conversion or page-level reading-progress persistence was added in this focused change.
- The Supabase migration updates the existing private bucket MIME allowlist and size ceiling, extends chapter format checks, and keeps the existing media access function as the signed URL authorization boundary.

## Implementation commits

- `53da2c4` — admin foundation and protected moderation dashboard.
- `b9821cf` — mobile navigation and accessibility foundations.
- `de98db1` — editor shortcut registry and help dialog.
- `8c00fae` — library discovery filters, search matching, and sorting.
- `373e9a0` — chapter-level ratings and reviews.
- `2a61813` — custom PDF.js reader and private PDF support.
- `4e0f800` — batch image-only manga panel authoring.
- `6703b10` — admin navigation link for authorized members.

## Additional decisions

- Admin membership is checked through the protected `admin_users` table; the navigation link is convenience only and not the security boundary.
- Manga page uploads reuse the existing comic newline format (`storage-reference|caption`) for backward compatibility.
- Batch manga uploads are capped at 100 pages and retain each image as an image; no conversion or PDF generation is performed.
- Reviews are chapter-level, not story-level, with one review per member per chapter.
- The current project remains intentionally small; no external search service or pagination infrastructure was introduced.
- Library cards use one outer link instead of nested title/author links so the entire card is clickable and keyboard-accessible.
- Library posters use signed story-media cover URLs when available, with a title placeholder fallback; descriptions are clamped to three lines.

## 2026-10-21 — UI polish follow-up

- The editor formatting drawer is treated as a non-modal dialog: it is removed from the accessibility tree with `inert` while closed, receives focus when opened, closes on Escape, and returns focus to its trigger.
- The editor overflow actions use a small ARIA menu with Escape, arrow-key, Home, and End navigation; this keeps the existing actions discoverable on narrow screens without changing the shortcut registry.
- The chapter reader keeps its custom controls and adds a mobile table-of-contents disclosure, semantic preference fieldsets, visible setting values, and a reset control. Native PDF styling remains avoided by the existing custom PDF viewer decision.
- Reader title/author context and image zoom/fullscreen remain separate follow-up work because the current UI polish pass focused on controls, semantics, and mobile discoverability.
- Mojibake in studio labels was repaired at the source; JSX apostrophes use escaped entities where required by the lint rules.
- `LibraryWork.cover_url` is optional at the type boundary so existing stories and test fixtures without a cover remain valid; the library still renders a deliberate poster fallback.

## 2026-10-21 — Performance follow-up

- The first performance fix targets request waterfalls and storage round trips: independent Supabase queries now start together, and cover/inline-image signing uses `createSignedUrls` in one batch.
- Chapter reviews are intentionally streamed after the reader shell with Suspense because they are secondary content and should not delay reading.
- No broad cross-request cache was added yet. Signed media URLs are bearer URLs tied to authorization and expire; caching them across users could reuse a private URL incorrectly. Browser/module caching and request batching are safer first steps for this 20-user project.
- A cache can be considered later for public, non-sensitive library metadata with a short revalidation window and explicit invalidation after publishing, once hosted latency is measured.

## 2026-10-21 — Personal shelf

- The shelf lives at `/shelf` and is only exposed in navigation for authenticated members.
- It reads the existing `user_bookmarks` and `reading_progress` rows; no new table or Discord integration is needed for this small private project.
- Progress below 100% is shown as currently reading; progress at 100% is shown as recently finished. Bookmarks are kept as a separate section, so a story can appear in more than one section.
- Shelf works and chapter titles are loaded only for the current user's saved IDs, and cover references are signed in one batch using the existing private media helper.
- A missing session gets a sign-in state; no saved rows get an empty state; query/storage failures get a retry state.

## 2026-10-21 — Reader completion and media interaction

- The chapter reader keeps the story title and author visible in the sticky reader header and exposes story details, contents, bookmark, share, and settings actions together.
- Chapter completion is inferred at 95% scroll progress, while reaching the document end records 100% so the existing shelf can classify the chapter as finished.
- Authenticated progress flushes use a reader-only endpoint with `navigator.sendBeacon` and a keepalive `fetch` fallback on pagehide, visibility changes, cleanup, and chapter navigation. Guest progress remains local-only.
- Inline images and comic panels open in a custom accessible viewer with Escape/Tab handling, focus return, bounded zoom, and native fullscreen when supported. The browser-native PDF viewer remains unused.
- Direct chapter links enforce the story's content-warning acknowledgement before rendering chapter content; acceptance is remembered per story on the reader device, while a back-to-story option remains available.

## 2026-10-21 — Publishing readiness and media cleanup

- The Creator Studio publish checklist is advisory for missing covers, missing content warnings, unpublished chapters, and incomplete content. The absence of a published chapter remains the only hard publication gate in the existing database RPC.
- The checklist evaluates the effective chapter content, including unpublished chapter drafts and revisions, so the author sees the state that would actually be published.
- Media cleanup scans works, work drafts, chapters, and chapter drafts before deleting an object. If any reference scan fails, cleanup stops rather than risking a live media reference.
- Work deletion removes the work row first, then deletes only objects in the authenticated owner's UUID folder. A migration widens the existing storage delete policy only to that owner folder so orphan cleanup still works after the work row is gone.
- Cleanup runs after cover replacement, metadata saves, chapter saves, chapter publication, chapter deletion, story publication, and story deletion. It is best-effort and logs only safe storage error codes.
- The stale recommended-sequence section was removed from the progress tracker; completed work is now represented in the current-state checkboxes and implementation updates.
