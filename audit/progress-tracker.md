# Smarties Archive Progress Tracker

This tracker is intentionally scoped for a private server project with about 20 users and a limited story collection.

Legend: `[x]` done · `[~]` partial / needs polish · `[ ]` next · `[-]` intentionally out of scope for now

## Member-requested features

These requests are now explicitly included in the plan:

| Request | Current status | Plan |
| --- | --- | --- |
| Keyboard shortcuts for formatting | `[x]` Centralized platform-aware shortcut map and help dialog are implemented | Keep expanding only if a new formatting command needs coverage |
| Text formatting | `[x]` Rich editor already supports headings, marks, lists, alignment, typography, literary treatments, spoilers, and more | Polish discoverability and shortcut coverage |
| Images between text | `[x]` Inline image blocks with upload, captions, alt text, width, alignment, and reader zoom/fullscreen already exist | Keep the current focused viewer |
| PDF support for manga | `[x]` PDF chapter format, private upload validation, signed media, custom PDF.js reader, and page controls are implemented | Hosted migration and real-file verification are tracked as manual checks below |
| Image-only manga | `[x]` Batch image upload, ordering, alt text, captions, removal, and reader zoom/fullscreen are implemented on the existing comic model | Keep the existing image model |
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
- [x] Replaced/deleted story-media cleanup scans current work and draft references before removal
- [x] Lightweight publish checklist for missing cover, warnings, unpublished chapters, and incomplete content

### Writing and content formats

- [x] Plain prose chapters
- [x] Rich TipTap editor
- [x] Headings, lists, marks, links, alignment, literary styles, emoji, and spoilers
- [x] Images with captions and alt text
- [x] Image, comic, chat, and mixed-media chapter formats
- [x] Structured validation with Zod
- [x] Safe React rendering instead of trusted HTML
- [x] Rich editor accessibility labels, dialog semantics, focus management, and keyboard navigation
- [-] Editor CSS consolidation is intentionally deferred; the current layered rules are stable and the private project has no design-system build step

### Reading

- [x] Story details page with cover, author, summary, tags, warnings, and chapters
- [x] Chapter table of contents
- [x] Previous/next chapter navigation
- [x] Font, size, line spacing, paragraph spacing, width, and theme controls
- [x] Dark, light, and sepia reading themes
- [x] Guest progress in local storage
- [x] Authenticated reading progress in Supabase
- [x] Story bookmarks in Supabase
- [x] Progress save is debounced with pagehide, visibility-change, navigation, and keepalive flushes
- [x] Direct chapter links show a content-warning acceptance gate and remember acceptance per story
- [x] Personal `/shelf` page groups bookmarked, currently-reading, and recently-finished stories with auth and empty states — `9228ce8`
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
- [x] Add reading-time metadata to cards
- [x] Add a simple sort option
- [x] Add a better no-results state
- [x] Add a small auto-featured shelf using the newest published stories; no editorial database field is needed for this private project
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
- [~] Apply the admin migration and bootstrap the first admin in the configured Supabase project — hosted access is unavailable from this workspace

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
- [~] Apply `supabase/migrations/202610210006_pdf_chapters.sql` to the configured Supabase project and test with a real PDF chapter — hosted access is unavailable from this workspace.

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

- [~] Apply and run the admin, review, PDF, and story-media cleanup migrations in the configured Supabase project. The connected Supabase tool rejected migration/list access with a permission error; committed SQL is ready to apply manually.
- [~] Bootstrap the first admin in `admin_users` after hosted access is restored.
- [~] Upload and read a real PDF chapter, and upload/reorder/caption/read a real image-only manga chapter, after hosted access is restored.
- [~] Run mobile checks at 320px, 375px, and 768px with a browser/device harness.
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
- [x] Added persistent story/author context and the reader action bar — `3f1205d`
- [x] Added an accessible zoom/fullscreen viewer for inline images and comic panels — `b478041`
- [x] Added chapter completion, continue actions, and robust authenticated progress flushing — `5511561`
- [x] Added direct chapter content-warning acceptance gates — `48076ae`

## Remaining UI verification

- [~] Run real-device checks at 320px, 375px, and 768px widths — browser/device harness is not installed in this workspace

## 2026-10-21 performance follow-up

- [x] Batch cover and inline-image signed URL creation instead of issuing one storage request per asset — `510e4df`
- [x] Parallelize independent work, chapter, author, contents, progress, and bookmark lookups — `ffac6a6`
- [x] Stream chapter reviews below the reader with a Suspense boundary so review/profile queries do not block the chapter shell — `ffac6a6`
- [x] Add a regression test for batched signed media requests — `34cfe4e`
- [~] Measure real hosted latency after the Supabase migrations/project configuration are available

## 2026-10-21 shelf follow-up

- [x] Added the authenticated `/shelf` route using existing bookmark and reading-progress tables — `9228ce8`
- [x] Added bookmarked, currently-reading, and recently-finished sections with progress details, posters, tags, and mobile-friendly cards.
- [x] Added signed-in-only desktop and mobile navigation links for My shelf.
- [x] Revalidated the shelf after bookmark and reading-progress updates.

## 2026-10-21 publishing follow-up

- [x] Add a Studio publish-readiness checklist with optional warnings and hard blockers — `4c1d2d3`
- [x] Remove replaced and deleted story-media objects only when they are no longer referenced — `fa19689`
- [x] Keep cleanup owner-scoped and preserve the existing server authorization checks — `fa19689`
- [~] Apply `supabase/migrations/20261021140000_story_media_cleanup.sql` to the configured Supabase project — hosted access is unavailable from this workspace
