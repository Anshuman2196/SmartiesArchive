# Implementation Decisions

## 2026-10-21 — Chapter reviews

- Reviews are chapter-level, not story-level, so members can rate individual chapters without implying a score for an unfinished story.
- Each member has at most one review per chapter, enforced by a database unique constraint on `(chapter_id, user_id)` and an upsert server action.
- Ratings are integers from 1 to 5. Review text is optional and capped at 2,000 characters in both Zod and Postgres validation.
- Review reads use RLS plus a small security-definer boolean helper. Public and unlisted published chapters expose reviews; private/draft chapters do not.
- Review identity fields cannot be changed after creation, preventing a direct client update from moving a review to another chapter or user.
- Users must be authenticated for create, update, and delete actions. RLS remains the final authorization boundary.
- The chapter page owns the full review interaction. The story page shows compact per-chapter rating summaries.
- No new UI dependencies or global CSS changes were added; the existing component and server-action patterns are reused.
- The Supabase CLI was unavailable in this environment, so the migration was created directly with the repository's established migration naming convention. The pgTAP test must be run where the Supabase CLI/local database is configured.
