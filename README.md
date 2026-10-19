# Smarties Archive

A Next.js and Supabase publishing app for a literary community. The current slice supports public registration, profiles, work/chapter management, published revisions, public/unlisted/private access, and an adjustable reader.

## Current scope

- Password sign-up, email confirmation, and password sign-in through Supabase Auth.
- A profile is created by a database trigger when a user registers.
- Creator Studio can edit work metadata, stage updates to published work details, create/edit/reorder/duplicate/unpublish/delete chapters, and explicitly publish work and chapter changes.
- Public published works appear in the searchable library and on author profiles. Unlisted works require the direct link. Private work and chapters are protected by PostgreSQL row-level security.
- Reader pages support prose, single image, manga/comic panels, chat transcripts, and mixed JSON media blocks. Existing plain-text chapters are backfilled as prose. Structured content is validated and rendered as React text/media nodes, never trusted HTML.
- Readers can save responsive reader preferences locally, resume guest progress locally, and save bookmarks/reading progress to their account. Story covers are HTTPS image URLs; Supabase Storage uploads are not configured.
- Responsive charcoal, sage, and lime interface with keyboard focus styling and semantic form labels.

Work and chapter drafts are stored in owner-only tables so readers keep seeing the published snapshot until explicit publication. A single pending revision is supported per work/chapter; historical revision browsing and restore are not implemented. There is no ratings/reviews/comments/reactions/reporting, manual spoiler system, follow/reading-list/universe feature, scheduled publishing, collaboration, or media file upload yet. The current schema has no slug field, so story editing does not expose slug changes.

## Requirements

- Node.js 22.6 or newer and npm (the test command uses Node's TypeScript stripping support).
- A Supabase project with email/password authentication enabled.
- Docker Desktop for local Supabase database tests.

## Local development

1. Install Node.js 22.6+ and npm. Install Docker Desktop and the Supabase CLI using the official [Supabase CLI installation guide](https://supabase.com/docs/guides/cli/getting-started).
2. Run `npm install` in the project folder.
3. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` to your project's Project URL, `NEXT_PUBLIC_SUPABASE_ANON_KEY` to its publishable/anon key, and `NEXT_PUBLIC_SITE_URL` to `http://localhost:3000` for local development. These are public client credentials; never put a service-role key in this application.
4. For a local isolated database, run `supabase start`. The CLI starts Postgres, Auth, and the local API using `supabase/config.toml`, then applies the migrations in timestamp order. If the stack was already running before you add a migration, apply pending migrations with `supabase migration up`. The local Auth confirmation URL is handled by `http://localhost:54321/auth/v1/verify` and redirects to the configured app callback; allow `http://localhost:3000/auth/callback` in Auth URL settings. `supabase status` prints the local URL and anon key; copy those values into `.env.local` while testing locally.
5. For a separate Supabase development project, authenticate with `supabase login`, link it using `supabase link --project-ref <project-ref>`, inspect migration history with `supabase migration list`, then run `supabase db push --dry-run`. On a fresh project, this previews all four migrations; review the preview before `supabase db push`. The original setup allowed applying migration `202610190001_initial.sql` manually in the SQL editor. If you did that, and migration history does not record `202610190001`, first verify the live schema exactly matches that migration, then record only that baseline with `supabase migration repair 202610190001 --status applied`. Do not run the repair command if the schema differs. Preview again, then push only pending forward migrations to a development project. Do not link or push this project to production as part of local verification.
6. In Supabase Auth URL configuration, set the local site URL to `http://localhost:3000` and allow `http://localhost:3000/auth/callback` as a redirect URL. For hosted environments, allow the matching HTTPS callback URL. Set `NEXT_PUBLIC_SITE_URL` to the exact public origin so confirmation emails return to this app.
7. Keep email confirmation enabled to verify the callback flow. In the Supabase confirmation email template, use the default `{{ .ConfirmationURL }}` link so Supabase verifies the address and redirects with the PKCE code to the `emailRedirectTo` callback. For local tests, open the Mailpit URL printed by `supabase status`, create two test accounts, and use separate browser profiles when checking cross-account access. Configure a production SMTP provider before opening registration publicly; Supabase's built-in mail service is limited.
8. Run `npm run dev` and open `http://localhost:3000`.

When email confirmation is enabled, a new member must confirm their email before signing in. Registration is public; no admin approval is built into this app.

## Authentication routes and email links

The app adapts to the Supabase project's confirmation setting using the signup response: a returned session signs the new member in and sends them to Creator Studio (or a validated local `next` path); no session displays the check-your-email state and offers a confirmation resend. The checked-in local `supabase/config.toml` enables email confirmations. A hosted Supabase project's Auth settings are managed separately and cannot be inferred from repository files.

Supabase email links use the PKCE authorization-code flow handled by `/auth/callback`. The callback exchanges the one-time code for the session and immediately redirects to an allowlisted local destination; errors are represented by fixed status codes, never reflected provider text or callback tokens. Password recovery returns through the same callback with `/auth/reset` as the local destination, where the signed-in recovery session can update the password.

In **Supabase Dashboard → Authentication → URL Configuration**, set Site URL to the deployment's exact HTTPS origin and add `https://your-deployment-domain/auth/callback` to Redirect URLs (also add the local callback URL for local development). For Vercel preview URLs, add the preview callback pattern or each exact preview callback URL using Supabase's Redirect URL rules. The confirmation email template must preserve Supabase's verification URL (`{{ .ConfirmationURL }}`); Supabase then redirects to this app's callback. Password recovery must also allow that callback destination. Set `NEXT_PUBLIC_SITE_URL` to the matching origin in each deployment environment.

The header resolves the current user on the server for initial render and hard refresh. Sign-in, sign-up, callback, and sign-out transitions navigate through server responses so the header is rendered with the refreshed cookie-backed session; no custom token storage or browser auth subscription is used. Creator Studio and individual work editing routes check the session on the server, and database RLS remains the authority for content access.

## Database and access model

The initial migration creates profiles, works, chapters, publication/visibility enums, indexes, the profile-on-signup trigger, and row-level security policies. The second migration makes API grants explicit, adds indexes, and maintains `updated_at`. The third restricts unlisted work to narrow direct-link reader functions. The fourth adds story metadata, validated chapter format payloads, owner-only work/chapter draft revisions, reader bookmarks/progress, and owner-checked publication/reordering procedures. Reader continuity rows cascade when their target chapter/work is deleted. Use new forward migrations for future schema changes; do not edit an already-applied migration in a shared environment. Do not disable RLS. The application uses the user's Supabase session and anon/publishable key; authorization is enforced in PostgreSQL and server actions.

Public listing is restricted to published public works. Published unlisted work is readable with its direct work/chapter URL through capability functions, but is not enumerable from the table API or library. Owners can read private work, drafts, and pending revisions. Published rows remain unchanged while work/chapter draft rows are edited; explicit publish functions apply pending changes. An unlisted work ID behaves as its share link, so treat that link as shareable. There is no collaborator table or policy; only the owner may mutate stories and chapters.

## Checks

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run db:test` (requires local Supabase services running; runs pgTAP against the local database)
- `npm run build`

The TypeScript tests cover input and chapter-format validation, safe reader rendering fallbacks, auth errors, and local redirect validation. The pgTAP tests create fixture users in a transaction that rolls back, then verify RLS visibility, owner-only draft staging and publishing, ordering, bookmark/progress ownership, and dependent deletion cleanup. They run only against the local test database. Apply migrations and run the suite against local Supabase before connecting a development project.

## Deployment

Deploy on a Node-compatible host such as Vercel. In **Project Settings → Environment Variables**, configure these exact names for every environment where the app should run (Production, Preview, and Development as needed):

- `NEXT_PUBLIC_SUPABASE_URL`: the Supabase project's Project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the project's publishable/anon key.
- `NEXT_PUBLIC_SITE_URL`: the app's exact public origin, including `https://` in production (no trailing slash).

The URL and anon key names are used by both the server client and session middleware; there is no separate browser Supabase client in this increment. Do not add a service-role key. After changing Vercel environment variables, trigger a new deployment because existing deployments do not pick up changed build environment values. Apply migrations to a development/staging project first and verify the pgTAP suite there before planning a production migration. Review `supabase db push --dry-run` and database backups before applying to production; this task has not connected to or modified any remote database. Add the production `/auth/callback` URL to Supabase's redirect allow list, configure custom SMTP and domain settings, enforce HTTPS, and review Auth rate limits and allowed signup policies before opening registration.
