# Smarties Archive Prototype Audit

Date: 2026-10-21
Scope: product features, UX/UI, user flows, reading experience, mobile accessibility, themes, codebase, architecture, and right-sized next steps for a private server project.

## Executive summary

Smarties Archive has a strong prototype core. The editorial visual identity is distinctive, the publishing model is unusually thoughtful for an early build, and the reader already supports typography controls, themes, progress, rich prose, images, comics, chat transcripts, mixed media, and spoilers.

This should be treated as a focused personal project for approximately 20 users and a limited story collection, not as a production platform for thousands of users. The most valuable gaps are an admin page, personal reading shelves, mobile navigation, direct-link safety, and a few reliability improvements.

Discord integration is intentionally out of scope. The recommended direction is to keep the current core stack and make the existing site feel complete for a small community: a shared story link should open a warning-aware reader, save progress reliably, lead to the next chapter, and place the story in the reader's personal shelf.

The actionable done/partial/next/later checklist is in [`progress-tracker.md`](./progress-tracker.md).

The member-requested feature mapping is also recorded there, including formatting shortcuts, text formatting, inline images, PDF manga, image-only manga, UI fixes, ratings/reviews, tags, filters, and improved search.

## Current stack

- Next.js 15 App Router and React 19
- Supabase Auth, Postgres, Row Level Security, and Storage
- TipTap 3 rich-text editor
- Zod validation
- Tailwind/PostCSS imported, but most UI is handcrafted global CSS
- Lucide React installed but barely used
- Server Components and Server Actions for most application flows

### Recommendation

Keep Next.js, React, Supabase, TipTap, and Zod. They fit a small private community well; there is no need to replace the stack or introduce a CMS.

Add an accessible primitives library only if implementing the mobile menu, admin dialogs, or settings drawers becomes cumbersome. Add a small browser smoke-test suite when the core flows stabilize; a large testing platform is unnecessary right now.

Use the framework's built-in metadata APIs for story/chapter metadata, Open Graph, sitemap, and robots configuration instead of adding a separate SEO library.

## Right-sized assessment

This is a private community project for roughly 20 users, so the following are deliberately not blockers:

- Discord OAuth or Discord server membership checks
- Pagination and large-scale search infrastructure
- Ratings, reviews, reactions, and social graphs
- Offline reading and high-volume moderation tooling
- Production-grade observability, rate limiting, and multi-tenant administration

## Current blockers and next improvements

### P0: No admin page or admin permission model

There is currently no admin surface. For this project, the MVP admin page should let an administrator view users and stories, hide/unpublish or delete inappropriate stories, and inspect basic counts. Protect it server-side with an explicit admin flag or allowlisted user IDs; do not rely on a hidden link or client-only check.

### P1: Mobile header likely overflows

At 320–375px, the signed-out header still contains Library, palette selector, Sign in, and Join free. There is no real collapsed navigation.

Evidence: `src/components/site-header.tsx:18`, `src/app/globals.css:11`.

### P1: Content warnings can be bypassed

Warnings appear on the story details page, but the direct chapter route does not load or display them. A shared deep link can send a reader directly into sensitive content.

Evidence: `src/app/work/[id]/page.tsx:52`, `src/app/work/[id]/chapter/[chapterId]/page.tsx:26-40`.

### P2: Discovery is basic but sufficient for now

The library searches only title and summary and hard-limits results to 60. This is acceptable for a small story collection, but covers, tags, a simple sort option, and a better no-results state would make it feel finished.

Evidence: `src/app/library/page.tsx:12-17`.

### P1: Core browser flows are lightly tested

There are no end-to-end tests for signup, publishing, unlisted access, uploads, reader progress, mobile navigation, or accessibility. For this project, a small smoke suite covering sign-in, publish, open story, and read-next is enough to start.

## Product and feature gaps

### Discovery

- Covers on library cards
- Simple tag and content-warning filters
- Sort by newest and recently updated
- Full-text search can wait until the collection grows
- Featured or “staff pick” shelf
- Ongoing, complete, hiatus, and abandoned story status
- Word count and estimated reading time
- Series, universe, collection, and related-story support can wait
- Continue reading for both signed-in users and returning guests
- A separate no-results state instead of the current empty-library message

### Reader and community

- My Shelf / reading list
- Reading history and completed stories
- Reliable chapter completion tracking
- Follow authors and receive updates
- Chapter-level comments with spoiler boundaries
- Reactions, ratings, reviews, and quote sharing
- Private highlights, notes, and bookmarks inside chapters
- In-story search
- Image zoom and fullscreen for comics and illustrations
- Print and offline reading
- End-of-story recommendations
- Chapter-level content warnings
- Reader report-issue action is optional for a trusted small group

### Creator workflow

- Revision history, comparison, and restore
- Scheduled publishing can wait
- Collaboration and editor permissions
- Bulk chapter management
- Draft preview links
- Profile editing, avatar, and social links
- Stable story slugs instead of UUID-only URLs
- Publish checklist for cover, warnings, tags, and incomplete chapters
- Automated orphaned-media cleanup
- Import/export for Markdown, EPUB, and JSON

## UX and user-flow audit

### Current reader flow

`Homepage → Library → Story page → Chapter reader`

### Current creator flow

`Sign up → Creator Studio → Create work → Add chapter → Save draft → Publish`

### Flow health

| Step | Health | Main issue |
| --- | --- | --- |
| Homepage → Library | Fair | Attractive, but little personalized discovery |
| Search → Story page | Weak | Only title/summary search; no filters or sorting |
| Story page → Chapter | Good | Strong cover, synopsis, tags, warnings, and chapter list |
| Reading | Good foundation | Strong controls, but weak context and completion states |
| Bookmark/resume | Incomplete | No shelf, history, or continuation dashboard |
| Sign up → Publish | Fair | Good publishing model, but no Discord access control |
| Mobile navigation | At risk | No real mobile menu |

### UX problems

- Homepage has no featured story, recent shelf, or continue-reading entry point.
- Bookmarking is effectively write-only because there is no bookmarks destination.
- Share and bookmark are only available on story details, not while reading.
- Empty search results look like an empty database and suggest writing the first story.
- Reader context is weak: story title, author, and cover disappear from the chapter surface.
- There is no “You finished this chapter” state or prominent next action.
- There are no custom loading, error, or not-found surfaces for most routes.
- Public-facing labels expose database states such as `published`, `public`, and `draft`.

## Story reading experience

### Strengths

- Table of contents
- Previous and next chapter navigation
- Adjustable typeface, text size, line spacing, paragraph spacing, and reading width
- Dark, light, and sepia themes
- Guest and authenticated progress
- Rich prose, images, comics, chats, and mixed content
- Safe structured rendering instead of trusted HTML
- Spoiler reveal controls

### High-value improvements

1. Add a persistent reader action bar for contents, bookmark, share, settings, report, and story details.
2. Show story title and author persistently while reading.
3. Add a sticky progress indicator that remains visible during long chapters.
4. Save progress on chapter navigation and `pagehide`, not only after a debounce.
5. Mark chapters complete around 90–95% and provide a clear completion state.
6. Add a strong next-chapter CTA and end-of-story state.
7. Add estimated reading time and word count.
8. Add media zoom/fullscreen for comics and illustrations.
9. Add in-story search, highlights, private notes, and quote sharing.
10. Add a warning gate directly in the reader route.
11. Merge guest progress into the account after sign-in.
12. Store reader preferences per account as well as locally.

Evidence: `src/components/reader-experience.tsx:128-173`.

## Mobile and accessibility audit

### Good foundations

- Most forms have semantic labels.
- Focus-visible styling exists.
- `aria-current`, `aria-pressed`, `aria-live`, and progressbar attributes are used.
- Native forms and details elements are used in several places.
- Reduced-motion rules exist.
- Rich image editing supports alt text.

### Findings

- No skip-to-content link.
- No collapsed mobile header navigation.
- Reader theme buttons and some controls are smaller than comfortable mobile targets.
- Reorder controls are approximately 25×25px.
- Reader preferences are a labelled `div`; use a labelled `fieldset` or region.
- The rich editor has no clear accessible name for the editable region.
- The editor removes the content focus outline.
- The formatting drawer has no focus transfer, focus return, Escape handling, modal semantics, or reliable focus isolation.
- Reset-password error text is not associated with inputs using `aria-describedby`.
- Empty image alt text becomes “Story illustration,” which may incorrectly announce decorative media.
- Long titles, URLs, usernames, and speaker names lack an explicit wrapping strategy.
- Mobile chapter navigation uses horizontal scrolling with limited discoverability.
- Wine palette eyebrow text is borderline for small-text contrast.
- Light reader focus styling may be too low contrast.
- Reduced motion support is incomplete; some hover and visual effects remain.
- No automated keyboard, zoom, screen-reader, contrast, or axe coverage exists.

Evidence: `src/components/site-header.tsx`, `src/components/reader-experience.tsx:166-173`, `src/components/rich-chapter-editor.tsx:179-202`, `src/app/auth/reset/password-form.tsx:12`, `src/app/globals.css`.

This is a source-level accessibility review, not a WCAG compliance claim. Browser testing at 320px, 375px, 768px, 200% zoom, keyboard-only, and with a screen reader is still required.

## UI and visual styling

### Strengths

- Distinctive charcoal, sage, lime, editorial visual identity
- Strong serif/sans-serif contrast
- Reader themes fit the product well
- Restrained cards and clear hierarchy
- Good use of focus rings and reduced-motion intent

### Problems

- `globals.css` contains duplicated editor rules from multiple iterations; later rules override earlier ones.
- Tailwind is imported while most styling is custom CSS, creating unclear ownership.
- `lucide-react` is installed but text glyphs are used for many controls.
- Several strings contain encoding corruption such as `Â·`, `â†‘`, and `â€™`.
- Reader controls are dense on mobile.
- Inline styles are used in page components instead of shared design primitives.
- Theme contrast is not automatically validated.

Recommended styling direction: preserve the current editorial identity, but define a small token system for color, spacing, type scale, focus, surface, and touch targets. Consolidate the CSS before adding more surface area.

## Codebase audit

### Strengths

- Good Zod validation boundaries
- Strong Supabase RLS and ownership checks
- Safe rich-document rendering
- Explicit draft/published separation
- Defensive authentication redirect handling
- Useful unit tests and pgTAP access-control tests

### Technical risks

- `src/app/actions.ts` is a large mixed service layer covering auth, publishing, media, bookmarks, progress, and editor persistence.
- Supabase results are manually typed and frequently cast with `as Work` or `as unknown as Work[]`.
- No generated Supabase TypeScript schema types.
- No consistent query/service layer for repeated work, chapter, and profile reads.
- No route-level `loading.tsx`, `error.tsx`, or `not-found.tsx` surfaces.
- Server-action errors are often redirect-string based, making recovery and testing harder.
- Signed media URLs can expire during long sessions.
- Replaced or deleted media is retained indefinitely.
- Reader preferences are browser-local only.
- External media URL handling is not unified.

Recommended action split:

- `auth-actions`
- `work-actions`
- `chapter-actions`
- `reader-actions`
- `media-actions`

Generate Supabase types, remove broad casts, centralize queries, and add browser tests before adding more product features.

## Priority roadmap

### Phase 0: Pilot blockers

- Discord OAuth and server/role authorization
- Moderation, reporting, blocking, and admin review
- Mobile navigation
- Reader warning gate
- Reliable progress persistence
- Custom error, loading, and not-found states
- Playwright and accessibility smoke tests

### Phase 1: Make reading habit-forming

- My Shelf
- Continue reading
- Reading history
- Chapter completion
- End-of-chapter next action
- Reader action bar
- Story and author context in reader
- Library filters and sorting

### Phase 2: Improve discovery and community

- Tags, genres, moods, tropes, and full-text search
- Covers and reading-time metadata in cards
- Follows and update notifications
- Spoiler-safe chapter discussions
- Reactions and quote sharing
- Recommendations and related stories

### Phase 3: Creator power

- Revision history and restore
- Scheduled publishing
- Discord announcements
- Collaboration
- Series/universe support
- Media cleanup and import/export

## Best differentiated idea

### Discord-native spoiler-safe Story Rooms

Each story gets a Discord-linked reading room:

- Discord verifies server membership and roles.
- Each chapter has a linked discussion thread.
- Readers only see discussion up to their current chapter.
- Quotes and reactions can sync between the site and Discord.
- Authors can schedule chapter drops and automatically announce them.
- The website remains the canonical reading experience while Discord becomes the social layer.

This turns Smarties Archive from “a site that stores stories” into a living, spoiler-safe community archive with a genuine Discord-specific moat.

## Verification and evidence limits

- 10 unit tests passed when run directly with Node.
- ESLint passed.
- TypeScript currently reports errors, including missing Next declarations and nullability issues.
- The production build did not complete in the available environment.
- No application source files were changed during the audit.
- A browser screenshot audit could not be completed because browser tooling was unavailable in this session.
- Graph extraction was attempted; the full run was blocked by missing semantic extraction support and SQL parsing dependencies, so the conclusions above are based on direct source and migration inspection plus parallel sub-agent reviews.
