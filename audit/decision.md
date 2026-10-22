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
