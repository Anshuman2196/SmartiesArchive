# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are a small private community of readers and writers. Readers browse original stories, save works, and read chapters with adjustable presentation controls. Writers draft, format, publish, and manage their own stories.

## Product Purpose

Smarties Archive is a quiet home for original fiction and small creative works. It should make reading feel inviting and focused, and make publishing feel approachable for people who want to share work without operating a public social platform.

## Positioning

The product combines an archive-like reading experience with a focused creator studio, including rich chapters, images, comics, chat transcripts, spoiler-safe reading, reading progress, and personal shelves.

## Operating Context

The site is used on desktop and mobile browsers by a small community. The main flow is homepage → library → story → chapter reader. The creator flow is sign up → studio → create work → add chapters → publish.

## Capabilities and Constraints

- Next.js App Router, React, Supabase Auth/Postgres/Storage, TipTap, and Lucide React are already in use.
- Public stories can be searched, filtered, sorted, and opened from the library.
- Story pages expose summaries, covers, tags, content warnings, chapter lists, and reading actions.
- The reader supports themes, type controls, progress, rich prose, images, comics, chat transcripts, mixed media, and spoilers.
- Preserve existing routes and product behavior while improving hierarchy, navigation, readability, accessibility, and visual consistency.
- Do not fabricate story data, testimonials, usage metrics, or community claims.

## Brand Commitments

Keep the Smarties Archive name and its intimate, story-first voice. The user has asked to preserve the existing dark theme and palettes as selectable options while introducing a stronger default visual system.

## Evidence on Hand

Existing stories, covers, tags, summaries, chapter content, reader controls, and creator workflows in the repository and Supabase schema. No external testimonials, press, or commercial proof should be invented.

## Product Principles

- Reading comes before browsing chrome.
- Make the next useful action obvious.
- A small archive should feel cared for, not empty.
- Give creators a calm path from draft to published story.
- Keep sensitive content and reader preferences legible and user-controlled.

## Accessibility & Inclusion

Maintain keyboard focus visibility, semantic labels, readable contrast, touch-friendly controls, responsive layouts, and reduced-motion support. Content warnings must remain visible and understandable at the point of entry.
