# Implementation Decisions

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
