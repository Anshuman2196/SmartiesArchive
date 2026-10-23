// Silent reading speed for fiction; used for every reading-time estimate in the archive.
export const WORDS_PER_MINUTE = 220;

export function countWords(text: string | null | undefined): number {
  return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

export function readingMinutes(wordCount: number): number {
  return wordCount > 0 ? Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE)) : 0;
}

export function formatReadingTime(minutes: number, { suffix = true } = {}): string {
  if (minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const label = hours ? `${hours} h${rest ? ` ${rest} min` : ""}` : `${minutes} min`;
  return suffix ? `${label} read` : label;
}
