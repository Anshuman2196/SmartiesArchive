export type WorkVisibility = "public" | "unlisted" | "private";

export function workVisibilityLabel(visibility: WorkVisibility): string {
  switch (visibility) {
    case "unlisted": return "Shared by link";
    case "private": return "Private";
    default: return "Public";
  }
}

export function workStatusLabel(state: "draft" | "published", visibility: WorkVisibility): string {
  const visibilityLabel = workVisibilityLabel(visibility);
  return state === "published" ? `Published · ${visibilityLabel}` : `Draft · Not live · ${visibilityLabel}`;
}
