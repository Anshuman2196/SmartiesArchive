# Smarties Archive Progress Tracker

## 2026-10-22 audit remediation (active)

Scope: resolve the reported reader, writer, consistency, accessibility, and robustness issues in `audit/*-2026-10-22.md` and the prior audit. Track each finding here as it is verified against code and fixed. P0/P1 data-loss and core reading/publishing issues are first, followed by P2 and P3 polish. Browser-only findings remain marked for manual confirmation unless the supplied screenshots or code provide enough evidence.

- [x] Reconcile the audit findings against the current code and track status by issue ID below.
- [~] Fix writer data loss, image saving, navigation, validation, and publish actions (W-01–W-05); W-02 remains under investigation.
- [~] Fix rich content and writer workflow usability (W-06–W-32); see issue statuses below.
- [~] Fix reader rendering, progress/resume, privacy, and mobile chrome (B-01–B-32); see issue statuses below.
- [~] Fix cross-cutting accessibility, metadata, loading/error, privacy, and consistency findings; see issue statuses below.
- [x] Update this tracker and `decision.md` with implementation outcomes and assumptions.
- [ ] Commit remediation after outstanding P0/P1 issues are resolved.

This tracker is intentionally scoped for a private server project with about 20 users and a limited story collection.

## 2026-10-22 implementation status

### Writer findings

| Finding | Status | Change / remaining work |
| --- | --- | --- |
| W-01 | `[~]` | Preserve the new-chapter composer across the first save by retaining `?new=1`; confirm in browser. |
| W-02 | `[~]` | Improve the image validation error and normalize inserted image attributes. Original save failure has no confirmed root cause; needs a real upload/save reproduction. |
| W-03 | `[~]` | Guard in-app link navigation and browser Back while dirty; browser Back restores the editor entry before prompting, but interaction behavior still needs browser confirmation. |
| W-04–W-05 | `[x]` | Preserve invalid chat input with inline validation; keep publish form mounted through submit. |
| W-06, W-13–W-14 | `[x]` | Restore list and quote styles and map document H1 headings to H2 in reader output. |
| W-07–W-12, W-15, W-18–W-21 | `[x]` | Fix select clipping, title wrapping, editor offsets/status, paste paragraphs, mixed block editing, manga copy, action feedback, banner styling, and publish labels. |
| W-16 | `[~]` | The first-save query is preserved through revalidation; browser Back restoration still needs direct interaction review. |
| W-17, W-19–W-21, W-23–W-28, W-30–W-32 | `[x]` | Full-screen focus, success/publish feedback, destructive confirmation, discard revision, details tab, page titles, compact cover, mobile toolbar, link dialog, live word count, and preview state are implemented. |
| W-22 | `[x]` | Zero-chapter completeness is a warning, and each checklist row links to its relevant Details or Chapters tab. |
| W-29 | `[~]` | Duplicate chapters are moved directly after the source with the existing reorder RPC; verify in the configured database. |

### Reader findings

| Finding group | Status | Change / remaining work |
| --- | --- | --- |
| B-01–B-04, B-09, B-12–B-15, B-19, B-24–B-25 | `[x]` | Improve reader defaults and theme contrast, sticky progress/toolbars, settings overlap behavior, saved-status width, guest privacy, owner resume/bookmark, shared theme scope, and reading-width alignment. |
| B-05–B-08 | `[~]` | Story-level completion and shared progress persistence now update timestamps and retain the furthest chapter. Needs live reader/shelf verification. |
| B-16–B-17, B-20, B-23–B-30, B-32 | `[~]` | Loading/metadata, dialog naming, mobile contents, theme scope, numbering, serif heading styling, copy/share, keyboard navigation, library density, and author-review suppression received code changes; responsive/theme rendering and review policy need browser/database confirmation. |
| B-18, B-21–B-22 | `[x]` | Added a hide-content-note filter, review success/deletion feedback, 10-second undo, edited marker, and higher-contrast destructive action. |
| B-31 | `[x]` | Library results fetch in batches of 100 and expose visible pagination with filters preserved. |

### Cross-cutting findings

| Finding group | Status | Change / remaining work |
| --- | --- | --- |
| P1-1–P1-4 | `[x]` | Add page metadata, palette pre-hydration, reader contrast tokens, and remove legacy Royal/Wine button overrides. |
| P2-1, P2-3, P2-5–P2-6, P2-8, P2-10–P2-12, P2-14 | `[x]` | Improve user-facing labels, control borders, heading hierarchy, server-rendered warning gate, loading/error states, optimized WebP assets, metadata endpoints, mobile navigation, and signup feedback. |
| P2-4 | `[~]` | Raise the audited editor, media, emoji, theme, filter-removal, and back controls to at least 44 px in CSS; confirm rendered sizes at 320/390 px. |
| P2-2, P2-7, P2-9, P2-15 | `[~]` | Styling consolidation, unlisted throttling, request/auth performance, and rate limiting remain. Unlisted story/chapter pages emit noindex metadata. |
| P2-13 | `[~]` | Standardize “Creator Studio” capitalization and use “story details” in writer UI/errors. The audience-specific “content warnings” (authoring) / “content notes” (reader) distinction is intentional; mixed apostrophe style and a full copy pass remain. |
| P3-1 | `[x]` | Corrected README scope and migration count, removed the empty `review-preview` route directory, and updated DESIGN/ASSETS image references to the shipped WebP files. |
| P3-2–P3-10 | `[~]` | Skip link targets each route's focusable main landmark; the editor's nested main landmark is a labelled section. Reduced-motion support, form boundary contrast, icon exceptions, production origin configuration, and sanitized signup callback destinations are addressed. PDF viewing and the rich editor now load as separate dynamic chunks; stateless label/separator wrappers no longer declare client boundaries, and the duplicate palette controls already synchronize through a shared event. Responsive checks, bundle measurement, and performance review remain; browser verification is pending because localhost access was denied by the browser origin gate. |

### Commit and verification

- The supplied audit reports and screenshots are retained as user-provided materials and excluded from the remediation commit, as are unrelated `Characters/` and `graphify-out/` paths.
- `npm run typecheck` passes after the current remediation changes. The test suite and lint were not run.
- Hosted Supabase migration/data operations and real-device/browser checks remain unverified.

Legend: `[x]` done · `[~]` partial / needs polish · `[ ]` next · `[-]` intentionally out of scope for now

## Member-requested features

These requests are now explicitly included in the plan:

| Request | Current status | Plan |
| --- | --- | --- |
| Keyboard shortcuts for formatting | `[x]` Centralized platform-aware shortcut map and help dialog are implemented | Keep expanding only if a new formatting command needs coverage |
| Text formatting | `[x]` Rich editor already supports headings, marks, lists, alignment, typography, literary treatments, spoilers, and more | Polish discoverability and shortcut coverage |
| Images between text | `[x]` Inline image blocks with upload, captions, alt text, width, and alignment already exist | Improve image insertion UX and add zoom/fullscreen in the reader |
| PDF support for manga | `[~]` PDF chapter format, private upload validation, signed media, custom PDF.js reader, and page controls are implemented | Apply the migration and verify with a real PDF in the configured Supabase project |
| Image-only manga | `[x]` Batch image upload, ordering, alt text, captions, and removal are implemented on the existing comic model | Add reader zoom/fullscreen polish later if needed |
| UI fixes | `[x]` Mobile navigation, skip link, touch targets, focus states, wrapping, and password error associations are implemented | Continue visual polish only after real-device checks |
| Reviews and ratings | `[x]` Chapter-level rating/review flow is implemented with one review per member per chapter | Migration, RLS, authenticated create/update/delete actions, chapter review UI, and story-page summaries are covered; run the database test in the configured Supabase environment |
| Tags and library filters | `[x]` URL-driven tag, warning, sort, and clear-filter controls are implemented | Keep the simple array-backed model |
| Better search | `[x]` Search matches title, summary, author, and tags with distinct empty states | Full-text search remains deferred |

## Current state

### Foundation and access

- [x] Next.js App Router application structure
- [x] Supabase Auth with email/password sign-up, sign-in, confirmation, and password recovery
- [x] Profile creation on registration
- [x] Public author profiles
- [x] Server-side session handling and middleware refresh
- [x] Owner-only access through Supabase RLS

### Story publishing

- [x] Create, edit, delete, and unpublish stories
- [x] Create, edit, duplicate, reorder, delete, and unpublish chapters
- [x] Draft versus published snapshots
- [x] Public, unlisted, and private visibility
- [x] Story summaries, tags, content warnings, and covers
- [x] Conflict checks using updated timestamps
- [x] Private story-media uploads with signed URLs
- [~] Replaced/deleted media is not automatically cleaned up
- [ ] Optional publish checklist for missing cover, warnings, or incomplete chapters

### Writing and content formats

- [x] Plain prose chapters
- [x] Rich TipTap editor
- [x] Headings, lists, marks, links, alignment, literary styles, emoji, and spoilers
- [x] Images with captions and alt text
- [x] Image, comic, chat, and mixed-media chapter formats
- [x] Structured validation with Zod
- [x] Safe React rendering instead of trusted HTML
- [x] Rich editor accessibility labels, dialog semantics, focus management, and keyboard navigation
- [~] CSS for the editor contains duplicated generations of rules

### Reading

- [x] Story details page with cover, author, summary, tags, warnings, and chapters
- [x] Chapter table of contents
- [x] Previous/next chapter navigation
- [x] Font, size, line spacing, paragraph spacing, width, and theme controls
- [x] Dark, light, and sepia reading themes
- [x] Guest progress in local storage
- [x] Authenticated reading progress in Supabase
- [x] Story bookmarks in Supabase
- [~] Progress save is debounced and can be lost during navigation
- [~] Warnings are shown on story details but not enforced on direct chapter links
- [~] Bookmarking has no shelf or bookmarks page
- [ ] Chapter completion state and “continue” action
- [ ] Reader action bar for contents, bookmark, share, settings, and story details
- [ ] Story title and author context in the chapter reader
- [ ] Image zoom/fullscreen for comics and illustrations

### Library and discovery

- [x] Public published story library
- [x] Search by title and summary
- [x] Author links from story cards
- [x] Library cards show covers/poster fallbacks, tags, and clamped descriptions
- [x] Empty search results are separated from an empty library
- [ ] Add reading-time metadata to cards
- [x] Add a simple sort option
- [x] Add a better no-results state
- [ ] Add a small featured/staff-pick shelf
- [-] Pagination and large-scale search infrastructure for now

### Navigation and accessibility

- [x] Semantic labels on most forms
- [x] Focus-visible styling
- [x] Reduced-motion support
- [x] Reader progressbar semantics
- [x] Mobile table-of-contents disclosure, preference fieldsets, reset control, and visible setting values
- [x] Mobile header collapses into an accessible menu
- [x] Shared navigation touch targets and focus states improved
- [x] Mobile chapter navigation uses a clear table-of-contents disclosure
- [x] Add a mobile navigation menu
- [x] Add a skip-to-content link
- [x] Associate reset-password errors with inputs
- [x] Add wrapping rules for long titles, URLs, and speaker names

### Admin

- [x] Decide the admin permission model: separate database-backed `admin_users` membership
- [x] Add a server-protected `/admin` route
- [x] Add admin navigation visible only to admins
- [x] Add overview counts: users, stories, published chapters, and recent activity
- [x] Add user list with profile and created date
- [x] Add story/chapter lists with author, visibility, publication state, and updated date
- [x] Add narrow unpublish/hide actions
- [x] Add database/RLS tests proving non-admin users cannot access admin actions
- [x] Apply the admin migration and bootstrap the first admin in the configured Supabase project

## Recommended next sequence

### 1. Build the admin page

Keep the first version small:

1. Add an admin flag or small allowlist.
2. Protect `/admin` and admin server actions on the server.
3. Show users and stories in two simple tables.
4. Add unpublish, hide, and delete actions with confirmation.
5. Add RLS or server-side authorization tests.

### 2. Add the formatting shortcut system

Audit the editor's default TipTap shortcuts, then explicitly add and document shortcuts for:

- Bold, italic, underline, strike, code, highlight, spoiler
- Heading/paragraph/blockquote changes
- Bulleted and numbered lists
- Link insertion/editing
- Text color and highlight color
- Text alignment and indent/outdent
- Superscript and subscript
- Literary treatments
- Insert image and emoji
- Divider, code block, clear formatting
- Undo, redo, save, preview, focus mode, and open formatting help

Use platform-aware `Mod` shortcuts so the same map works on Windows/Linux and macOS. Avoid overriding browser or screen-reader shortcuts, and provide a visible “Keyboard shortcuts” help panel.

### 3. Make direct reading safe

- Load story warnings on the chapter route.
- Show a warning gate before the reader content.
- Preserve the reader's intended chapter after the reader accepts.

### 4. Complete the personal reading loop

- Add `/shelf` or `/library/mine`.
- Show bookmarked stories, currently reading, and recently finished.
- Flush progress before chapter navigation and on `pagehide`.
- Mark a chapter complete near the end of the page.

### 5. Add manga/PDF reading support

- Keep the existing image-only comic format; do not convert images into another format.
- Add batch upload and drag/drop ordering for manga pages.
- Add continuous vertical manga reading and page-level progress.
- Add zoom/fullscreen and a page counter.
- Add PDF upload validation and a PDF reader surface for manga distributed as PDFs.
- Decide whether PDFs are whole-chapter assets or one asset per chapter; whole-chapter assets are simpler for this small project.

### 6. Fix the mobile reading flow

- Collapse the global header into a menu.
- Turn the chapter list into a clear drawer or “Chapters” control.
- Increase small reader and studio targets to at least roughly 40–44px.
- Test at 320px and 375px widths.

### 7. Add reviews, ratings, tags, filters, and search improvements

- Add a one-rating-per-user-per-story model.
- Add optional short reviews with author/admin removal controls.
- Show average rating and rating count on story pages, but avoid ranking pressure for a small community.
- Add tag chips and content-warning filters to the library.
- Add newest/recently-updated sorting.
- Search title, summary, tags, and author display name.
- Show separate no-results and no-stories states.

### 8. Polish discovery and content presentation

- Add cover thumbnails to library cards.
- Add tags and reading time.
- Separate “no results” from “no stories yet.”
- Fix corrupted punctuation/arrow characters.

### 9. Add a small smoke-test pass

Cover only the flows that matter to this group:

- Sign in
- Create and publish a story
- Open a shared story link
- Accept a warning and read a chapter
- Navigate to the next chapter
- Bookmark and find the story on the shelf
- Open admin as admin and reject access as a normal user

## Later, only if the group asks for it

- Comments or chapter discussions
- Reactions and quote sharing
- Author follows
- Series/universe support
- Revision history and restore
- Scheduled publishing
- Import/export
- Offline reading
- More advanced search and recommendations

## Explicitly out of scope for now

- Discord integration
- Large-scale pagination/search infrastructure
- Enterprise moderation tooling
- Multi-tenant administration
- Production-grade analytics and observability

## 2026-10-21 implementation update

- [x] Added the `pdf` chapter format and private `story-media` PDF references.
- [x] Added 50 MB PDF signature/size validation while preserving the 8 MB image limit.
- [x] Added custom PDF.js rendering with lazy visible-page loading, zoom, page controls, keyboard navigation, and download/open fallback.
- [x] Apply `supabase/migrations/202610210006_pdf_chapters.sql` to the configured Supabase project and test with a real PDF chapter.

## 2026-10-21 implementation update

- [x] Admin foundation and protected dashboard — `53da2c4`
- [x] Mobile navigation and accessibility foundations — `b9821cf`
- [x] Editor formatting shortcuts and shortcut help — `de98db1`
- [x] Library tags, filters, search, and sorting — `8c00fae`
- [x] Chapter-level ratings and reviews — `373e9a0`
- [x] Custom PDF.js manga reader — `2a61813`
- [x] Batch image-only manga panel authoring — `4e0f800`
- [x] Admin navigation link for authorized members — `6703b10`

## Remaining verification

- [ ] Apply and run the admin, review, and PDF migrations in the configured Supabase project. The connected Supabase tool rejected migration/list access with a permission error; the committed SQL is ready to apply manually.
- [x] Bootstrap the first admin in `admin_users`.
- [ ] Upload and read a real PDF chapter.
- [ ] Upload, reorder, caption, save, and read a real image-only manga chapter.
- [ ] Run mobile checks at 320px, 375px, and 768px.
- [~] Perform a clean production build with no concurrent Next processes. Tests, lint, and typecheck pass; the build remained at optimization because unrelated Next workers were already running.

## 2026-10-21 library card follow-up

- [x] Added cover/poster thumbnails with a styled fallback when no cover exists.
- [x] Added visible tag chips and tag count metadata.
- [x] Clamped long descriptions to three lines with overflow hidden.
- [x] Made the entire story card a single keyboard-accessible link.

## 2026-10-21 UI polish follow-up

- [x] Repaired mojibake arrows, separators, and apostrophes in the studio UI — `0c7f35d`, `ac4fb5a`
- [x] Added accessible editor drawer semantics, focus return, Escape handling, overflow-menu keyboard navigation, and editor naming — `3bbb895`
- [x] Added mobile reader contents disclosure, semantic reading-preference groups, reset control, visible values, and larger touch targets — `2313d82`
- [x] Kept stories without covers valid in library filter/test fixtures — `a490118`

## Next UI work

- [ ] Add persistent story title/author context to the chapter reader
- [ ] Add image zoom/fullscreen for comics and inline illustrations
- [ ] Run real-device checks at 320px, 375px, and 768px widths
- [ ] Remove or consolidate duplicated editor CSS rules after visual regression checks

## 2026-10-21 performance follow-up

- [x] Batch cover and inline-image signed URL creation instead of issuing one storage request per asset — `510e4df`
- [x] Parallelize independent work, chapter, author, contents, progress, and bookmark lookups — `ffac6a6`
- [x] Stream chapter reviews below the reader with a Suspense boundary so review/profile queries do not block the chapter shell — `ffac6a6`
- [x] Add a regression test for batched signed media requests — `34cfe4e`
- [ ] Measure real hosted latency after the Supabase migrations/project configuration are available
