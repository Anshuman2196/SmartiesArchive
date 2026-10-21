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
