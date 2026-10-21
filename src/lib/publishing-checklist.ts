export type PublishChecklistChapter = {
  title: string;
  state: "draft" | "published";
  body?: string | null;
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
    incomplete.length
      ? { id: "drafts", label: "Chapter completeness", detail: `${incomplete.length} chapter${incomplete.length === 1 ? " is" : "s are"} missing content. Review before sharing the story.`, tone: "warning" }
      : unpublished.length
        ? { id: "drafts", label: "Unpublished changes", detail: `${unpublished.length} chapter${unpublished.length === 1 ? " is" : "s are"} still unpublished or has an unpublished revision.`, tone: "warning" }
        : { id: "drafts", label: "Chapter completeness", detail: "There are no unpublished chapter changes.", tone: "ready" },
  ];
}
