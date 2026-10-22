# Audit Remediation Decisions

## 2026-10-22 assumptions

- The reader, writer, cross-cutting, and prior audit findings in `audit/` define this remediation. Existing fixes are credited only after checking the current working tree.
- Preserve existing story/chapter behavior and stored content formats unless an audit identifies a defect. Keep existing Supabase rows and migrations compatible.
- Treat browser-observed defects as actionable. Mark viewport and interaction results for browser confirmation when they cannot be established from code or supplied screenshots.
- Keep the `[AUDIT]` stories, bookmarks, and other hosted Supabase records untouched during local code remediation. Audit notes identify cleanup candidates, but removing live records is destructive and not part of a local code change.
- Track each finding as fixed, partial, or deferred in `progress-tracker.md`; compiling alone does not count as verification.

## Implementation notes

- New reader progress writes update `updated_at`; a lower-position chapter cannot replace a reader's furthest saved chapter.
- Reader completion is classified at the story level: a completed earlier chapter stays in Currently reading, and the last published chapter determines Recently finished.
- The editor's first autosave updates the URL to preserve its new-chapter state through the server refresh.
- Mixed format remains stored as the existing JSON block format for compatibility, while the authoring UI edits structured blocks instead of requiring JSON.
- Content-note exclusion is an independent exact-match filter, so readers can include one note while excluding another; matching remains case-insensitive as before.
- Review deletion offers a 10-second undo window. Restoring uses the signed-in user's own review on the same still-published chapter, and story authors' reviews are excluded from displayed review lists and averages.
- `NEXT_PUBLIC_SITE_URL` may fall back to localhost in development, but must be an HTTP(S) origin in production because it is used for auth redirects and site metadata.
- Email-confirmation callbacks preserve the auth form's `next` path in a query parameter, sanitized on both creation and callback with `safeNextPath`. This matches the existing password-recovery callback pattern while keeping redirects same-origin.
- Each route's main content landmark is now the skip-link target and can receive focus; the editor writing area is a labelled section inside the studio page's main landmark. Browser confirmation could not be performed because the localhost origin approval gate denied access.
- Raise the controls called out in the tap-target audit to a 44 px minimum, including controls whose phone breakpoint rules had overridden earlier sizing. Leave viewport verification open until a browser is available.
- Dynamically split the PDF viewer and rich prose editor with `next/dynamic`; retain server rendering and show an accessible loading status. Remove client directives only from the stateless label and separator wrappers; keep the field wrapper client-side because it uses `useMemo`. The two palette controls already synchronize their state through a shared window event.
- Standardize the visible product name as “Creator Studio” and use “story details” in author-facing errors and save actions. Keep “content warnings” for authoring controls and “content notes” for reader-facing presentation to match their different contexts.
- Display visibility consistently as “Public,” “Private,” or “Shared by link” in reader and writer surfaces; preserve the existing `public`/`private`/`unlisted` values in storage and URLs.
- The reader progress endpoint accepts same-origin `sendBeacon`/fetch requests only, requires a matching Origin header, and verifies the chapter belongs to the submitted work and is published before upserting progress. Broader per-user rate limiting remains unimplemented because throttling the frequent progress flushes could lose reader position without a durable limiter.
- Cache the current Supabase user lookup with React's per-request `cache` in Server Components that share the site header. This removes duplicate auth lookups between the header and page while preserving cookie-based personalized rendering; authenticated routes still render dynamically.
- Middleware uses Supabase SSR `getClaims()` before returning the response, which validates JWT claims locally when supported and preserves refresh-cookie handling without fetching the full user profile from Auth on every request.
- Content-warning acceptance is stored in a same-site, HttpOnly cookie scoped to the story. The chapter page returns a standalone gate before serializing reader content to the client; the gate follows the reader tone saved in local preferences.
- The home hero and static genre/cover artwork are shipped as WebP; the hero uses a prioritized Next image while the CSS layer keeps its existing shade and framing.
