/** Normalize platform line endings without changing authored whitespace. */
export function normalizeChapterPaste(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}
