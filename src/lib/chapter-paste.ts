/** Turn a long clipboard paste into readable prose without imported layout markup. */
export function normalizeChapterPaste(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00a0\u200b-\u200d\ufeff]/g, " ")
    .split("\n")
    .map((line) => line.replace(/[\t\f\v ]+/g, " ").trim())
    .filter(Boolean);
}
