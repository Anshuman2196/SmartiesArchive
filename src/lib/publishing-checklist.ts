export type PublishChecklistChapter = {
  title: string;
  state: "draft" | "published";
  body?: string | null;
  content?: unknown;
  hasDraft?: boolean;
};

export type PublishChecklistItem = {
  id: "cover" | "warnings" | "chapters" | "drafts";
  label: string;
  detail: string;
  tone: "ready" | "warning" | "blocking";
};

export function getPublishChecklist({ coverUrl, contentWarnings, chapters }: { coverUrl?: string | null; contentWarnings?: string[] | null; chapters: PublishChecklistChapter[] }): PublishChecklistItem[] {
  const published = chapters.filter((chapter) => chapter.state === "published");
  const unpublished = chapters.filter((chapter) => chapter.state === "draft" || chapter.hasDraft);
  const incomplete = chapters.filter((chapter) => !chapter.body?.trim());
  const missingImageDescriptions = chapters.reduce((total, chapter) => total + countMissingImageDescriptions(chapter.content), 0);

  return [
    coverUrl?.trim()
      ? { id: "cover", label: "Cover image", detail: "A cover is ready for the story page and library.", tone: "ready" }
      : { id: "cover", label: "Cover image", detail: "Optional, but adding one makes the story easier to recognize.", tone: "warning" },
    contentWarnings?.length
      ? { id: "warnings", label: "Content warnings", detail: `${contentWarnings.length} warning${contentWarnings.length === 1 ? "" : "s"} added.`, tone: "ready" }
      : { id: "warnings", label: "Content warnings", detail: "No warnings added. Confirm that this is intentional before sharing.", tone: "warning" },
    published.length
      ? { id: "chapters", label: "Published chapters", detail: `${published.length} chapter${published.length === 1 ? " is" : "s are"} ready for readers.`, tone: "ready" }
      : { id: "chapters", label: "Published chapters", detail: "Publish at least one chapter before publishing the story.", tone: "blocking" },
    chapters.length === 0
      ? { id: "drafts", label: "Chapter completeness", detail: "Create a chapter before checking its content.", tone: "warning" }
      : incomplete.length
      ? { id: "drafts", label: "Chapter completeness", detail: `${incomplete.length} chapter${incomplete.length === 1 ? " is" : "s are"} missing content. Review before sharing the story.${missingImageDescriptions ? ` ${missingImageDescriptions} image${missingImageDescriptions === 1 ? " is" : "s are"} also missing a description.` : ""}`, tone: "warning" }
      : missingImageDescriptions
      ? { id: "drafts", label: "Image descriptions", detail: `${missingImageDescriptions} image${missingImageDescriptions === 1 ? " is" : "s are"} missing a description. Add alt text for meaningful images; leave it blank only for decorative images.`, tone: "warning" }
      : unpublished.length
        ? { id: "drafts", label: "Unpublished changes", detail: `${unpublished.length} chapter${unpublished.length === 1 ? " is" : "s are"} still unpublished or has an unpublished revision.`, tone: "warning" }
        : { id: "drafts", label: "Chapter completeness", detail: "There are no unpublished chapter changes.", tone: "ready" },
  ];
}

function countMissingImageDescriptions(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((total, item) => total + countMissingImageDescriptions(item), 0);
  if (typeof value !== "object" || value === null) return 0;
  const node = value as Record<string, unknown>;
  if (node.type === "image") return typeof node.alt === "string" && node.alt.trim() ? 0 : 1;
  if (node.type === "imageBlock") {
    const attrs = typeof node.attrs === "object" && node.attrs !== null ? node.attrs as Record<string, unknown> : {};
    return typeof attrs.alt === "string" && attrs.alt.trim() ? 0 : 1;
  }
  if (node.type === "comic" && Array.isArray(node.panels)) {
    return node.panels.reduce((total, panel) => {
      if (typeof panel !== "object" || panel === null) return total + 1;
      const alt = (panel as Record<string, unknown>).alt;
      return total + (typeof alt === "string" && alt.trim() ? 0 : 1);
    }, 0);
  }
  return Object.values(node).reduce((total, child) => total + countMissingImageDescriptions(child), 0);
}
