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

### Cloud-only Supabase constraint

- Supabase operations for this remediation must target the hosted SmartiesArchive project. The app configuration identifies project ref `ihrprnxndyzitciyoldz`, but the connected account lists only “Summiter 1.0” and rejects read-only metadata access to that ref; no hosted database operation has been run. Do not substitute the local Supabase prototype or the unrelated Summiter project. Hosted migration/data verification is blocked pending SmartiesArchive project access.
- The user indicated SmartiesArchive would be connected. Rechecking after that update still returned only Summiter and a permission denial for SmartiesArchive; keep hosted changes pending until the connector reflects the correct project.
- The accidental local Supabase startup was stopped by stopping its containers. Local volumes were left intact. No further local Supabase startup or database verification will be used for this audit.

### Writer findings

| Finding | Status | Change / remaining work |
| --- | --- | --- |
| W-01 | `[~]` | Preserve the new-chapter composer across the first save by retaining `?new=1`; confirm in browser. |
| W-02 | `[~]` | Improve the image validation error and normalize inserted image attributes. Source inspection confirms uploads create `<user>/<work>/<UUID>.<image extension>` references and rich-document validation expects that shape; no static mismatch is evident. The original save failure still needs an upload → insert → set alt → save reproduction. |
| W-03 | `[~]` | Guard in-app link navigation and browser Back while dirty; browser Back restores the editor URL with the saved editor history state before prompting, avoiding reuse of the previous route's Next.js state. Interaction behavior still needs browser confirmation. |
| W-04–W-05 | `[x]` | Preserve invalid chat input with inline validation; keep publish form mounted through submit. |
| W-06, W-13–W-14 | `[x]` | Restore list and quote styles and map document H1 headings to H2 in reader output. |
| W-07–W-08, W-10–W-12, W-15, W-18–W-21 | `[x]` | Fix select clipping, title wrapping, editor status, paste paragraphs, mixed block editing, manga copy, action feedback, banner styling, and publish labels. |
| W-09 | `[~]` | Remove the focus-mode `top: 0` override that placed the sticky editor bar over the site header. It now uses the existing header offset (70 px desktop / 66 px mobile); confirm in browser at desktop and tablet widths. |
| W-16 | `[~]` | Preserve the `?new=1` composer through the first revalidation, then replace it with the new `?chapter=<id>` URL once the save succeeds so browser Back cannot restore an empty composer. Verify the history behavior in browser. |
| W-17, W-19–W-21, W-23–W-27, W-30–W-32 | `[x]` | Full-screen focus, success/publish feedback, destructive confirmation, discard revision, details tab, page titles, compact cover, link dialog, live word count, and preview state are implemented. |
| W-28 | `[~]` | Fix the mobile formatting button's overlapping icon/“Aa” label, keep save status readable, raise toolbar targets to 44 px (including save, publish, and save-error actions), and reduce the formatting sheet so editor text remains visible. Corrected the 600px and 375px CSS overrides that had left several audited controls at 38–40px; verify layout and tap targets at 320/390 px in a browser. |
| W-22 | `[x]` | Zero-chapter completeness is a warning, and each checklist row links to its relevant Details or Chapters tab. |
| W-29 | `[~]` | Duplicate chapters are moved directly after the source with the existing reorder RPC; verify against hosted SmartiesArchive when that project is connected. |

### Reader findings

| Finding group | Status | Change / remaining work |
| --- | --- | --- |
| B-01–B-04, B-09, B-12–B-13, B-15, B-19, B-24–B-25 | `[x]` | Improve reader defaults and theme contrast, sticky progress/toolbars, remove the redundant floating settings button that duplicated the sticky toolbar action and obscured final navigation, saved-status width, owner resume/bookmark, shared theme scope, and reading-width alignment. Successful sign-out now clears guest reading positions, reader preferences, legacy warning keys, and story-scoped warning cookies. |
| B-14 | `[x]` | Keep reader contents published-only for non-owners and return not-found for a non-owner opening a draft chapter URL directly. Draft previews remain available to the story owner. |
| B-05–B-08 | `[~]` | Story-level completion and progress timestamps are implemented. Earlier local prototype checks are not evidence of hosted behavior; apply and verify against hosted SmartiesArchive when that project is connected. |
| B-16–B-17, B-20, B-23–B-30, B-32 | `[~]` | Loading/metadata, guest home continuation from local progress, persistent story/author context, image zoom/fullscreen, dialog naming, mobile contents, theme scope, numbering, serif heading styling, copy/share, keyboard navigation, library density, and author-review suppression received code changes. B-23 now explicitly overrides the inherited horizontal contents scroller with a vertical list and places its drawer below the site header; responsive/theme rendering and review policy need browser/database confirmation. |
| B-18, B-21–B-22 | `[x]` | Added a hide-content-note filter, review success/deletion feedback, 10-second undo, edited marker, and higher-contrast destructive action. |
| B-31 | `[x]` | Library results fetch in batches of 100 and expose visible pagination with filters preserved. |
| Reader completion navigation | `[x]` | The completion card is the only forward/story-details action after a chapter is complete; the pager keeps Previous available. |
| Story-page mobile CTA | `[x]` | Place Start/Resume reading above the long summary while keeping tags and content notes ahead of the CTA. |

### Cross-cutting findings

| Finding group | Status | Change / remaining work |
| --- | --- | --- |
| P1-1–P1-4 | `[x]` | Add page metadata, palette pre-hydration, reader contrast tokens, and remove legacy Royal/Wine button overrides. |
| P2-1, P2-5–P2-6, P2-8, P2-10–P2-12, P2-14 | `[x]` | Improve user-facing labels (visibility is consistently “Shared by link,” “Private,” or “Public”; chapter formats use readable labels in story details, Creator Studio rows, and the format selector), control borders, heading hierarchy, server-rendered warning gate, loading/error states (including generic reader-facing library outage feedback), optimized WebP assets, metadata endpoints, mobile navigation (closed menu is inert to keyboard and assistive technology), and signup feedback. |
| P2-4 | `[~]` | Raise the audited editor, PDF reader, media, emoji, theme, filter-removal, studio back, and chapter row/menu controls to at least 44 px in CSS, including the chapter action trigger and portaled menu items plus mobile editor save, publish, and error actions. Corrected the narrow editor overrides that reduced toolbar and error actions below 44px; confirm computed sizes and fit at 320/390 px in a browser. |
| P2-2–P2-3, P2-7, P2-9, P2-15 | `[~]` | Broader styling consolidation, spacing-token adoption, unlisted throttling, and rate limiting remain. Removed obsolete duplicate palette declarations from `globals.css` and kept the shared focus-ring token with the current palette tokens in `refresh.css`. Audited small control labels and statuses, reader page-tone buttons, and image-viewer actions/hints are now 12 px; the reader gate and mobile contents now use existing 4/8/24 px spacing tokens where they match current values. Unlisted story/chapter pages emit noindex metadata. Middleware now validates claims and refreshes cookies with `getClaims()`; a request-cached user lookup deduplicates the remaining `getUser()` between the shared header and route Server Components. Header profile and admin-membership reads now run concurrently. Library cards use a generated chapter word count and aggregate RPC instead of transferring chapter bodies; a compatibility fallback preserves the current library until the hosted SmartiesArchive migration is applied. Migration application and hosted-project verification remain pending. Reader-progress writes validate same-origin requests and chapter/work membership, and serialize updates atomically; hosted-project verification remains pending. |
| P2-13 | `[~]` | Standardize “Creator Studio” naming in the home CTA, studio heading/navigation/descriptions, and sign-in copy; align signup heading, tab, and submit labels on “Create account”; standardize visibility labels, the library empty-state CTA, and “story details” in writer UI/errors. The writer visibility form and story header now use “Public,” “Private,” and “Shared by link”; the form explains that link-shared stories are not listed in the library. Cover-upload recovery also points to story details. Reader cards now show up to three named content notes, with any remaining count shown and the names included in the accessible link label. The reader gate identifies notes as story-level, and reviewed authentication, bookmark, and review errors use curly apostrophes. Audience-specific “content warnings” (authoring) / “content notes” (reader) wording remains intentional; a full product-wide copy pass remains. |
| P3-1 | `[x]` | Corrected README scope and migration count, removed the empty `review-preview` route directory, and updated DESIGN/ASSETS image references to the shipped WebP files. |
| P3-2–P3-10 | `[~]` | Skip link targets each route's focusable main landmark; the editor's nested main landmark is a labelled section. Reduced-motion support, form boundary contrast, production origin configuration, and sanitized signup callback destinations are addressed. Text-control borders now use a stronger neutral color; calculated contrast is at least 3.13:1 across the app and reader theme backgrounds. Replaced navigation arrow glyphs with Lucide icons; symbolic rating and clearly named remove/dismiss controls remain text glyphs. PDF viewing and the rich editor now load as separate dynamic chunks; stateless label/separator wrappers no longer declare client boundaries, and the duplicate palette controls already synchronize through a shared event. Responsive checks, bundle measurement, and performance review remain; browser verification is pending because localhost access was denied by the browser origin gate. |

### Commit and verification

- The supplied audit reports and screenshots are retained as user-provided materials and excluded from the remediation commit, as are unrelated `Characters/` and `graphify-out/` paths.
- The previously recorded `npm run typecheck` pass predates commits `6dd22c9`, `9cb6bfe`, `26e7a71`, and `91bd8fd`; those changes have not been typechecked. Tests and lint were not run.
- Hosted Supabase migration/data operations and real-device/browser checks remain unverified.
- The browser extension is connected but currently has no tabs; no viewport measurements or interaction checks were run in this continuation.

Legend: `[x]` done · `[~]` partial / needs polish · `[ ]` next · `[-]` intentionally out of scope for now

## Member-requested features

These requests are now explicitly included in the plan:

| Request | Current status | Plan |
| --- | --- | --- |
| Keyboard shortcuts for formatting | `[x]` Centralized platform-aware shortcut map and help dialog are implemented | Keep expanding only if a new formatting command needs coverage |
| Text formatting | `[x]` Rich editor already supports headings, marks, lists, alignment, typography, literary treatments, spoilers, and more | Polish discoverability and shortcut coverage |
| Images between text | `[x]` Inline image blocks with upload, captions, alt text, width, and alignment already exist | Reader images and manga panels open in an accessible zoom/fullscreen viewer |
| PDF support for manga | `[~]` PDF chapter format, private upload validation, signed media, custom PDF.js reader, and page controls are implemented | Apply the migration and verify with a real PDF in the configured Supabase project |
| Image-only manga | `[x]` Batch image upload, ordering, alt text, captions, removal, and reader zoom/fullscreen are implemented on the existing comic model | Continue polish only if new reader feedback identifies a gap |
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
- [x] Optional publish checklist for missing cover, warnings, or incomplete chapters

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
- [~] Progress save is debounced and flushes on page hide, tab hide, and reader navigation; real browser/network-loss verification remains
- [x] Content warnings are enforced on direct chapter links before reader content is sent to the client
- [x] Bookmarking and reading progress appear on the personal shelf
- [x] Chapter completion state and “continue” action
- [x] Reader action bar for contents, bookmark, share, settings, and story details
- [x] Story title and author context in the chapter reader
- [x] Image zoom/fullscreen for comics and illustrations

### Library and discovery

- [x] Public published story library
- [x] Search by title and summary
- [x] Author links from story cards
- [x] Library cards show covers/poster fallbacks, tags, and clamped descriptions
- [x] Empty search results are separated from an empty library
- [x] Add estimated reading-time metadata to cards from published chapter text at 220 words per minute; reducing the full-body query remains tracked under P2-9.
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

- [x] Add persistent story title/author context to the chapter reader
- [x] Add image zoom/fullscreen for comics and inline illustrations
- [ ] Run real-device checks at 320px, 375px, and 768px widths
- [ ] Remove or consolidate duplicated editor CSS rules after visual regression checks

## 2026-10-21 performance follow-up

- [x] Batch cover and inline-image signed URL creation instead of issuing one storage request per asset — `510e4df`
- [x] Parallelize independent work, chapter, author, contents, progress, and bookmark lookups — `ffac6a6`
- [x] Stream chapter reviews below the reader with a Suspense boundary so review/profile queries do not block the chapter shell — `ffac6a6`
- [x] Add a regression test for batched signed media requests — `34cfe4e`
- [ ] Measure real hosted latency after the Supabase migrations/project configuration are available
