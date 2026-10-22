import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { signStoryMediaUrls } from "@/lib/story-media";
import styles from "./library-card.module.css";
import { LibraryToolbar } from "@/components/library-toolbar";
import { CoverFallback } from "@/components/cover-fallback";
import {
  getLibraryOptions,
  hasActiveLibraryFilters,
  matchesLibraryFilters,
  parseLibraryFilters,
  sortLibraryWorks,
  type LibrarySearchParams,
  type LibraryWork,
} from "@/lib/library-filters";
import type { Metadata } from "next";
import { getWorkReviewSummaries } from "@/lib/chapter-reviews";

export const metadata: Metadata = { title: "Library", description: "Browse stories in the Smarties Archive." };

const sortLabels = {
  newest: "Newest first",
  updated: "Recently updated",
  oldest: "Oldest first",
  title: "Title A–Z",
} as const;

type PublishedChapterSummary = { work_id: string; chapter_count: number | string; word_count: number | string };
type PublishedChapterBody = { work_id: string; body: string };

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function readingMinutes(wordCount: number): number {
  return wordCount ? Math.max(1, Math.ceil(wordCount / 220)) : 0;
}

function LibraryPoster({ work, eager = false }: { work: LibraryWork; eager?: boolean }) {
  return <div className={styles.poster} aria-hidden="true">
    {work.coverPreviewUrl ? <Image className={styles.posterImage} src={work.coverPreviewUrl} alt="" fill sizes="(max-width: 540px) 112px, (max-width: 760px) 50vw, 33vw" unoptimized priority={eager}/> : <CoverFallback title={work.title}/>}
  </div>;
}

function LibraryTags({ work, filters }: { work: LibraryWork; filters: ReturnType<typeof parseLibraryFilters> }) {
  if (work.tags.length === 0) return null;
  return <div className={styles.tags} aria-label={`Tags for ${work.title}`}>
    {work.tags.slice(0, 3).map((tag) => { const params = new URLSearchParams(); if (filters.q) params.set("q", filters.q); params.set("tag", tag); if (filters.warning) params.set("warning", filters.warning); if (filters.excludeWarning) params.set("excludeWarning", filters.excludeWarning); if (filters.sort !== "newest") params.set("sort", filters.sort); return <Link className={`tag ${styles.tag}`} key={tag} href={`/library?${params.toString()}`}>{tag}</Link>; })}
    {work.tags.length > 3 && <span className={styles.moreTags}>+{work.tags.length - 3}</span>}
  </div>;
}

function LibraryWarnings({ work }: { work: LibraryWork }) {
  if (work.content_warnings.length === 0) return null;
  return <div className={styles.warnings} aria-label={`Content notes for ${work.title}`}>
    {work.content_warnings.slice(0, 3).map((warning) => <span className={styles.warning} key={warning}>{warning}</span>)}
    {work.content_warnings.length > 3 && <span className={styles.warningMore}>+{work.content_warnings.length - 3} more</span>}
  </div>;
}

function libraryStoryLinkLabel(work: LibraryWork, rating?: { average: number; count: number }) {
  const warnings = work.content_warnings.slice(0, 3);
  const ratingLabel = rating ? ` Story rating ${rating.average.toFixed(1)} out of 5 from ${rating.count} ${rating.count === 1 ? "reader" : "readers"}.` : "";
  if (warnings.length === 0) return `Open story: ${work.title}.${ratingLabel}`;

  const remainingCount = work.content_warnings.length - warnings.length;
  const remainingLabel = remainingCount > 0 ? `, and ${remainingCount} more` : "";
  return `Open story: ${work.title}.${ratingLabel} Content notes: ${warnings.join(", ")}${remainingLabel}`;
}

function LibraryAuthor({ work }: { work: LibraryWork }) {
  const name = work.profiles?.display_name ?? "A reader";
  return <span className={styles.author}>By {work.profiles?.username ? <Link href={`/author/${work.profiles.username}`}>{name}</Link> : name}</span>;
}

function filterHref(filters: ReturnType<typeof parseLibraryFilters>, key: "q" | "tag" | "warning" | "excludeWarning"): string {
  const params = new URLSearchParams();
  if (key !== "q" && filters.q) params.set("q", filters.q);
  if (key !== "tag" && filters.tag) params.set("tag", filters.tag);
  if (key !== "warning" && filters.warning) params.set("warning", filters.warning);
  if (key !== "excludeWarning" && filters.excludeWarning) params.set("excludeWarning", filters.excludeWarning);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  const query = params.toString();
  return query ? `/library?${query}` : "/library";
}

function pageHref(filters: ReturnType<typeof parseLibraryFilters>, page: number): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.warning) params.set("warning", filters.warning);
  if (filters.excludeWarning) params.set("excludeWarning", filters.excludeWarning);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  params.set("page", String(page));
  return `/library?${params.toString()}`;
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<LibrarySearchParams> }) {
  const query = await searchParams;
  const filters = parseLibraryFilters(query);
  const requestedPage = Number(Array.isArray(query.page) ? query.page[0] : query.page) || 1;
  const currentPage = Math.max(1, Math.floor(requestedPage));
  let allWorks: LibraryWork[] = [];
  let configured = true;
  let reviewClient: Awaited<ReturnType<typeof createClient>> | null = null;

  try {
    const supabase = await createClient();
    reviewClient = supabase;
    const works: LibraryWork[] = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await supabase
        .from("works")
        .select("id,author_id,title,summary,cover_url,created_at,updated_at,tags,content_warnings,profiles(username,display_name)")
        .eq("visibility", "public")
        .eq("state", "published")
        .order("created_at", { ascending: false })
        .range(offset, offset + 99);
      if (error) throw error;
      works.push(...((data ?? []) as unknown as LibraryWork[]));
      if (!data || data.length < 100) break;
    }
    const workIds = works.map((work) => work.id);
    const [chapterStatsResult, coverUrls] = await Promise.all([
      workIds.length ? supabase.rpc("get_public_library_chapter_stats", { p_work_ids: workIds }) : Promise.resolve({ data: [] as PublishedChapterSummary[], error: null }),
      signStoryMediaUrls(supabase, works.map((work) => work.cover_url)),
    ]);
    let chapterStats = chapterStatsResult.data as PublishedChapterSummary[] | null;
    if (chapterStatsResult.error) {
      // Keep the library available while the hosted project is waiting for this migration.
      const { data, error } = await supabase.from("chapters").select("work_id,body").in("work_id", workIds).eq("state", "published");
      if (error) throw error;
      const fallbackStats = new Map<string, { chapter_count: number; word_count: number }>();
      for (const chapter of (data ?? []) as PublishedChapterBody[]) {
        const stat = fallbackStats.get(chapter.work_id) ?? { chapter_count: 0, word_count: 0 };
        stat.chapter_count += 1;
        stat.word_count += countWords(chapter.body);
        fallbackStats.set(chapter.work_id, stat);
      }
      chapterStats = [...fallbackStats].map(([work_id, stats]) => ({ work_id, ...stats }));
    }
    const statsByWork = new Map<string, PublishedChapterSummary>((chapterStats ?? []).map((stats) => [stats.work_id, stats] as const));
    allWorks = works.map((work) => {
      const stats = statsByWork.get(work.id);
      const chapterCount = Number(stats?.chapter_count ?? 0);
      const wordCount = Number(stats?.word_count ?? 0);
      return { ...work, coverPreviewUrl: work.cover_url ? coverUrls.get(work.cover_url) ?? null : null, chapterCount, readingMinutes: readingMinutes(wordCount) };
    });
  } catch {
    configured = false;
  }

  const filteredWorks = sortLibraryWorks(allWorks.filter((work) => matchesLibraryFilters(work, filters)), filters.sort);
  const pageSize = 24;
  const pageCount = Math.max(1, Math.ceil(filteredWorks.length / pageSize));
  const page = Math.min(currentPage, pageCount);
  const visibleWorks = filteredWorks.slice((page - 1) * pageSize, page * pageSize);
  let reviewSummaries: Record<string, { average: number; count: number }> = {};
  if (reviewClient && visibleWorks.length) {
    try {
      reviewSummaries = await getWorkReviewSummaries(reviewClient, visibleWorks.map((work) => work.id), Object.fromEntries(visibleWorks.flatMap((work) => work.author_id ? [[work.id, work.author_id] as const] : [])));
    } catch { /* Keep the library visible when ratings are temporarily unavailable. */ }
  }
  const tags = getLibraryOptions(allWorks, "tags");
  const warnings = getLibraryOptions(allWorks, "content_warnings");
  const activeFilters = hasActiveLibraryFilters(filters);

  return <main id="main-content" tabIndex={-1} className="shell section library-page">
    <div className="library-intro">
      <div><span className="eyebrow">Read / Discover</span><h1 className="serif">The library</h1><p className="library-deck">Find a story by title, author, or tag. Content notes are available before you begin reading.</p></div>
      <span className="library-count">{filteredWorks.length} {filteredWorks.length === 1 ? "story" : "stories"}</span>
    </div>

    <LibraryToolbar filters={filters} tags={tags} warnings={warnings}/>

    {activeFilters && configured && <div className="library-active-filters" aria-label="Active filters">
      {filters.q && <span className="tag">Search: {filters.q} <Link href={filterHref(filters, "q")} aria-label="Remove search filter">×</Link></span>}
      {filters.tag && <span className="tag">Tag: {filters.tag} <Link href={filterHref(filters, "tag")} aria-label="Remove tag filter">×</Link></span>}
      {filters.warning && <span className="tag">Content note: {filters.warning} <Link href={filterHref(filters, "warning")} aria-label="Remove content note filter">×</Link></span>}
      {filters.excludeWarning && <span className="tag">Hidden note: {filters.excludeWarning} <Link href={filterHref(filters, "excludeWarning")} aria-label="Remove hidden content note filter">×</Link></span>}
      {filters.sort !== "newest" && <span className="tag">Sort: {sortLabels[filters.sort]}</span>}
      <Link className="text-action" href="/library">Clear all</Link>
    </div>}

    {!configured && <p className="notice" role="status">The library is temporarily unavailable. Please try again in a moment.</p>}
    {configured && allWorks.length === 0 && <div className="library-empty"><h2 className="serif">No public stories yet.</h2><p>When a story is published, you’ll find it here.</p><Link href="/studio" className="pill primary">Open Creator Studio</Link></div>}
    {configured && allWorks.length > 0 && filteredWorks.length === 0 && <div className="library-empty"><h2 className="serif">No stories match.</h2><p>Try another search or clear the filters.</p><Link href="/library" className="pill primary">Clear filters</Link></div>}

    {visibleWorks.length > 0 && <section className="library-results" aria-label="Stories"><div className="library-results-heading"><span>{activeFilters ? "Results" : "Recently added"}</span><span>{filteredWorks.length} {filteredWorks.length === 1 ? "story" : "stories"}</span></div><div className={styles.list}>{visibleWorks.map((work, index) => { const rating = reviewSummaries[work.id]; return <article className={styles.card} key={work.id}>
      <Link className={styles.posterLink} href={`/work/${work.id}`} aria-label={libraryStoryLinkLabel(work, rating)}><LibraryPoster work={work} eager={index < 3}/></Link>
      <div className={styles.body}>
        <h2 className={styles.title}><Link href={`/work/${work.id}`}>{work.title}</Link></h2>
        {work.summary && <p className={styles.summary}>{work.summary}</p>}
        <LibraryTags work={work} filters={filters}/>
        <LibraryWarnings work={work}/>
        <div className={styles.meta}><LibraryAuthor work={work}/><span>{work.chapterCount ?? 0} {work.chapterCount === 1 ? "chapter" : "chapters"}{work.readingMinutes ? ` · about ${work.readingMinutes} min` : ""}</span>{rating && <span aria-label={`Story rating ${rating.average.toFixed(1)} out of 5 from ${rating.count} readers`}>★ {rating.average.toFixed(1)} · {rating.count} {rating.count === 1 ? "reader" : "readers"}</span>}</div>
      </div>
    </article>; })}</div>{pageCount > 1 && <nav className="library-pagination" aria-label="Library pages"><span>Page {page} of {pageCount}</span>{page > 1 && <Link className="pill" href={pageHref(filters, page - 1)} rel="prev">Previous page</Link>}{page < pageCount && <Link className="pill primary" href={pageHref(filters, page + 1)} rel="next">Next page</Link>}</nav>}</section>}
  </main>;
}
