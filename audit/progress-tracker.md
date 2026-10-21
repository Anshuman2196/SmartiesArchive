# Smarties Archive Progress Tracker

This tracker is intentionally scoped for a private server project with about 20 users and a limited story collection.

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
- [~] Rich editor accessibility needs labeling and focus management
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
- [~] Library cards lack covers and useful metadata
- [~] Empty search results are confused with an empty library
- [ ] Add covers, tags, and reading-time metadata to cards
- [ ] Add a simple sort option
- [ ] Add a better no-results state
- [ ] Add a small featured/staff-pick shelf
- [-] Pagination and large-scale search infrastructure for now

### Navigation and accessibility

- [x] Semantic labels on most forms
- [x] Focus-visible styling
- [x] Reduced-motion support
- [x] Reader progressbar semantics
- [x] Mobile header collapses into an accessible menu
- [x] Shared navigation touch targets and focus states improved
- [~] Mobile chapter navigation uses horizontal scrolling with limited affordance
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
- [ ] Apply the admin migration and bootstrap the first admin in the configured Supabase project

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
- [ ] Apply `supabase/migrations/202610210006_pdf_chapters.sql` to the configured Supabase project and test with a real PDF chapter.

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

- [ ] Apply and run the admin, review, and PDF migrations in the configured Supabase project.
- [ ] Bootstrap the first admin in `admin_users`.
- [ ] Upload and read a real PDF chapter.
- [ ] Upload, reorder, caption, save, and read a real image-only manga chapter.
- [ ] Run mobile checks at 320px, 375px, and 768px.
- [ ] Perform a clean production build with no concurrent Next processes.
