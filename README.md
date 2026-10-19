# Smarties Archive

A Next.js and Supabase foundation for a literary publishing community. The current vertical slice supports public registration, profiles, work drafting, chapter drafting and publishing, and reading public, unlisted, and owner-private works.

## Current scope

- Password sign-up, email confirmation, and password sign-in through Supabase Auth.
- A profile is created by a database trigger when a user registers.
- Creator Studio can create a work, choose public/unlisted/private visibility, and add ordered text chapters as drafts or published chapters.
- Public published works appear in the searchable library and on author profiles. Unlisted works require the direct link. Private work and chapters are protected by PostgreSQL row-level security.
- Reader pages preserve chapter text and paragraph breaks. Work and chapter content is rendered as text, not trusted HTML.
- Responsive charcoal, sage, and lime interface with keyboard focus styling and semantic form labels.

This increment does not yet implement TipTap or the requested rich-text/manga/chat/mixed-media chapter formats, media uploads, work/chapter reviews or ratings, comments and replies, spoiler markers, bookmarks/progress, follows, reading lists, universe paths, collaboration, revision history, or moderation/reporting. These require additional schema, UI, and policy increments.

## Requirements

- Node.js 22.6 or newer and npm (the test command uses Node's TypeScript stripping support).
- A Supabase project with email/password authentication enabled.
- Docker Desktop for local Supabase database tests.

## Local development

1. Install Node.js 22.6+ and npm. Install Docker Desktop and the Supabase CLI using the official [Supabase CLI installation guide](https://supabase.com/docs/guides/cli/getting-started).
2. Run `npm install` in the project folder.
3. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` to your project's Project URL, `NEXT_PUBLIC_SUPABASE_ANON_KEY` to its publishable/anon key, and `NEXT_PUBLIC_SITE_URL` to `http://localhost:3000` for local development. These are public client credentials; never put a service-role key in this application.
4. For a local isolated database, run `supabase start`. The CLI starts Postgres, Auth, and the local API using `supabase/config.toml`, then applies the migrations in timestamp order. If the stack was already running before you add a migration, apply pending migrations with `supabase migration up`. The local Auth confirmation URL is handled by `http://localhost:54321/auth/v1/verify` and redirects to the configured app callback; allow `http://localhost:3000/auth/callback` in Auth URL settings. `supabase status` prints the local URL and anon key; copy those values into `.env.local` while testing locally.
5. For a separate Supabase development project, authenticate with `supabase login`, link it using `supabase link --project-ref <project-ref>`, inspect migration history with `supabase migration list`, then run `supabase db push --dry-run`. On a fresh project, this previews all three migrations; review the preview before `supabase db push`. The original setup allowed applying migration `202610190001_initial.sql` manually in the SQL editor. If you did that, and migration history does not record `202610190001`, first verify the live schema exactly matches that migration, then record only that baseline with `supabase migration repair 202610190001 --status applied`. Do not run the repair command if the schema differs. Preview again, then push only the pending forward migrations to a development project. Do not link or push this project to production as part of local verification.
6. In Supabase Auth URL configuration, set the local site URL to `http://localhost:3000` and allow `http://localhost:3000/auth/callback` as a redirect URL. For hosted environments, allow the matching HTTPS callback URL. Set `NEXT_PUBLIC_SITE_URL` to the exact public origin so confirmation emails return to this app.
7. Keep email confirmation enabled to verify the callback flow. In the Supabase confirmation email template, use the default `{{ .ConfirmationURL }}` link so Supabase verifies the address and redirects with the PKCE code to the `emailRedirectTo` callback. For local tests, open the Mailpit URL printed by `supabase status`, create two test accounts, and use separate browser profiles when checking cross-account access. Configure a production SMTP provider before opening registration publicly; Supabase's built-in mail service is limited.
8. Run `npm run dev` and open `http://localhost:3000`.

When email confirmation is enabled, a new member must confirm their email before signing in. Registration is public; no admin approval is built into this app.

## Database and access model

The initial migration creates `profiles`, `works`, and `chapters`, publication and visibility enums, indexes, a profile-on-signup trigger, and row-level security policies. The second migration makes API grants explicit, adds author/chapter indexes, and maintains `updated_at`. The third tightens unlisted work access: public table queries cannot enumerate unlisted rows; the server resolves a direct unlisted URL through narrowly scoped database functions that require its random work UUID. Use a new forward migration for future schema changes; do not edit an already-applied migration in a shared environment. Do not disable RLS. The application uses the user's Supabase session and anon/publishable key; authorization is enforced in PostgreSQL and in each Creator Studio server action.

Public listing is restricted to published public works. Published unlisted work is readable with its direct work/chapter URL through the capability functions, but is not selectable from the table API or listed. Owners can read and manage their own drafts and private content. An unlisted work ID behaves as its share link, so treat that link as shareable. There is no collaborator table or policy yet; only the owner may mutate works and chapters.

## Checks

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run db:test` (requires local Supabase services running; runs pgTAP against the local database)
- `npm run build`

The TypeScript tests cover input schema boundaries. The pgTAP tests create two fixture users in a transaction that rolls back, then verify profile creation/update ownership, public/unlisted/private visibility, draft URL denial, and owner-only work/chapter mutations. They run only against the local test database. No Supabase project credentials or test project are configured in this repository, so no live registration, email callback, or cross-account test has been performed. Apply migrations and run the suite against local Supabase before connecting a development project.

## Deployment

Deploy on a Node-compatible host such as Vercel. Configure the three public environment variables for each environment. Apply migrations to a development/staging project first and verify the pgTAP suite there before planning a production migration. Review `supabase db push --dry-run` and database backups before applying to production; this task has not connected to or modified any remote database. Add the production `/auth/callback` URL to Supabase's redirect allow list, configure custom SMTP and domain settings, enforce HTTPS, and review Auth rate limits and allowed signup policies before opening registration. Keep the Supabase service-role secret out of frontend and server runtime configuration for this slice.
