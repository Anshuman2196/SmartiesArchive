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

- Node.js 20.9 or newer and npm.
- A Supabase project with email/password authentication enabled.

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the project's URL and publishable/anon key. These are public client credentials; never put a service-role key in this application.
3. Apply `supabase/migrations/202610190001_initial.sql` to the project, for example with `supabase db push` after linking the project, or paste the migration into the Supabase SQL editor.
4. In Supabase Auth URL configuration, set the local site URL to `http://localhost:3000` and allow `http://localhost:3000/auth/callback` as a redirect URL. For hosted environments, allow the matching HTTPS callback URL. `NEXT_PUBLIC_SITE_URL` can be set to the canonical site URL used when signup sends confirmation links.
5. In Supabase email templates, keep the confirmation link pointed to `{{ .SiteURL }}/auth/callback?code={{ .Token }}` or the default PKCE confirmation flow. Configure a production SMTP provider before opening registration publicly; Supabase's built-in mail service is limited.
6. Run `npm run dev` and open `http://localhost:3000`.

When email confirmation is enabled, a new member must confirm their email before signing in. Registration is public; no admin approval is built into this app.

## Database and access model

The initial migration creates `profiles`, `works`, and `chapters`, publication and visibility enums, indexes, a profile-on-signup trigger, and row-level security policies. Use a new forward migration for future schema changes; do not edit an already-applied migration in a shared environment. Do not disable RLS. The application uses the user's Supabase session and anon/publishable key; authorization is enforced in PostgreSQL as well as the Creator Studio queries.

Public listing is restricted to published public works. Published unlisted work is readable with its direct work/chapter URL, but is not listed. Owners can read and manage their own drafts and private content. An unlisted work ID behaves as its share link, so treat that link as shareable.

## Checks

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

The validation tests cover input schema boundaries. To verify actual registration, publication, and cross-account access, configure a Supabase project and test with two accounts; no live project credentials are included in this repository.

## Deployment

Deploy on a Node-compatible host such as Vercel. Configure the two Supabase public environment variables and `NEXT_PUBLIC_SITE_URL` for each environment. Apply migrations before deploying code that depends on them. Add the production `/auth/callback` URL to Supabase's redirect allow list, configure custom SMTP and domain settings, enforce HTTPS, and review Auth rate limits and allowed signup policies before opening registration. Keep the Supabase service-role secret out of frontend and server runtime configuration for this slice.
