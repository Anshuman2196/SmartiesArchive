import type { ChapterFormat } from "@/lib/chapter-content";

const labels: Record<ChapterFormat, string> = {
  prose: "Prose",
  image: "Single image",
  comic: "Manga / comic",
  chat: "Chat fiction",
  mixed: "Mixed media",
  pdf: "PDF chapter",
};

export function chapterFormatLabel(format: string | null | undefined): string {
  if (!format) return "Prose";
  return Object.prototype.hasOwnProperty.call(labels, format) ? labels[format as ChapterFormat] : "Other format";
}
