export const librarySortOptions = ["newest", "updated", "oldest", "title"] as const;

export type LibrarySort = (typeof librarySortOptions)[number];

export type LibrarySearchParams = Record<string, string | string[] | undefined>;

export type LibraryFilters = {
  q: string;
  tag: string;
  warning: string;
  sort: LibrarySort;
};

export type LibraryWork = {
  id: string;
  title: string;
  summary: string;
  cover_url?: string | null;
  coverPreviewUrl?: string | null;
  chapterCount?: number;
  readingMinutes?: number;
  created_at: string;
  updated_at: string;
  tags: string[];
  content_warnings: string[];
  profiles: { username: string; display_name: string } | null;
};

const sortSet = new Set<string>(librarySortOptions);

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function normalizeLibraryValue(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function parseLibraryFilters(params: LibrarySearchParams): LibraryFilters {
  const sort = firstValue(params.sort);

  return {
    q: firstValue(params.q).trim(),
    tag: firstValue(params.tag).trim(),
    warning: firstValue(params.warning).trim(),
    sort: sortSet.has(sort) ? (sort as LibrarySort) : "newest",
  };
}

export function hasActiveLibraryFilters(filters: LibraryFilters): boolean {
  return Boolean(filters.q || filters.tag || filters.warning || filters.sort !== "newest");
}

function includesNormalized(values: string[], needle: string): boolean {
  const normalizedNeedle = normalizeLibraryValue(needle);
  return values.some((value) => normalizeLibraryValue(value) === normalizedNeedle);
}

export function matchesLibraryFilters(work: LibraryWork, filters: LibraryFilters): boolean {
  const query = normalizeLibraryValue(filters.q);
  const searchableText = [
    work.title,
    work.summary,
    work.profiles?.username ?? "",
    work.profiles?.display_name ?? "",
    ...work.tags,
  ].map(normalizeLibraryValue);

  return (
    (!query || searchableText.some((value) => value.includes(query))) &&
    (!filters.tag || includesNormalized(work.tags, filters.tag)) &&
    (!filters.warning || includesNormalized(work.content_warnings, filters.warning))
  );
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function sortLibraryWorks(works: LibraryWork[], sort: LibrarySort): LibraryWork[] {
  return [...works].sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });

    const aDate = timestamp(sort === "updated" ? a.updated_at : a.created_at);
    const bDate = timestamp(sort === "updated" ? b.updated_at : b.created_at);
    return sort === "oldest" ? aDate - bDate : bDate - aDate;
  });
}

export function splitFeaturedWorks(works: LibraryWork[], showFeatured: boolean): { featuredWorks: LibraryWork[]; remainingWorks: LibraryWork[] } {
  const featuredWorks = showFeatured ? works.slice(0, 3) : [];
  const featuredIds = new Set(featuredWorks.map((work) => work.id));
  return { featuredWorks, remainingWorks: works.filter((work) => !featuredIds.has(work.id)) };
}

export function getLibraryOptions(works: LibraryWork[], field: "tags" | "content_warnings"): string[] {
  const options = new Map<string, string>();

  for (const work of works) {
    for (const value of work[field]) {
      const label = value.trim();
      if (label && !options.has(normalizeLibraryValue(label))) options.set(normalizeLibraryValue(label), label);
    }
  }

  return [...options.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
