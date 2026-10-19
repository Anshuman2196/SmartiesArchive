export type ReaderPreferences = { theme: "dark" | "light" | "sepia"; font: "serif" | "sans"; size: number; leading: number; spacing: number; width: number };

export const defaultReaderPreferences: ReaderPreferences = { theme: "dark", font: "serif", size: 20, leading: 1.85, spacing: 1.2, width: 760 };

const bounded = (value: unknown, fallback: number, min: number, max: number, precision = 0) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const factor = 10 ** precision;
  return Math.min(max, Math.max(min, Math.round(value * factor) / factor));
};

export function normalizeReaderPreferences(value: unknown): ReaderPreferences {
  const candidate = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  return {
    theme: candidate.theme === "light" || candidate.theme === "sepia" ? candidate.theme : "dark",
    font: candidate.font === "sans" ? "sans" : "serif",
    size: bounded(candidate.size, defaultReaderPreferences.size, 16, 28),
    leading: bounded(candidate.leading, defaultReaderPreferences.leading, 1.4, 2.2, 1),
    spacing: bounded(candidate.spacing, defaultReaderPreferences.spacing, 0.5, 2.5, 1),
    width: candidate.width === 620 || candidate.width === 900 ? candidate.width : 760,
  };
}

export function isSecureMediaUrl(value: string | undefined): value is string {
  if (!value) return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
