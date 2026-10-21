import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getLibraryOptions,
  hasActiveLibraryFilters,
  matchesLibraryFilters,
  parseLibraryFilters,
  sortLibraryWorks,
  type LibrarySearchParams,
  type LibraryWork,
} from "@/lib/library-filters";

const sortLabels = {
  newest: "Newest first",
  updated: "Recently updated",
  oldest: "Oldest first",
  title: "Title A–Z",
} as const;

function filterHref(filters: ReturnType<typeof parseLibraryFilters>, key: "q" | "tag" | "warning"): string {
  const params = new URLSearchParams();
  if (key !== "q" && filters.q) params.set("q", filters.q);
  if (key !== "tag" && filters.tag) params.set("tag", filters.tag);
  if (key !== "warning" && filters.warning) params.set("warning", filters.warning);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  const query = params.toString();
  return query ? `/library?${query}` : "/library";
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<LibrarySearchParams> }) {
  const filters = parseLibraryFilters(await searchParams);
  let allWorks: LibraryWork[] = [];
  let configured = true;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("works")
      .select("id,title,summary,created_at,updated_at,tags,content_warnings,profiles(username,display_name)")
      .eq("visibility", "public")
      .eq("state", "published")
      .order("created_at", { ascending: false })
      .limit(100);
    allWorks = (data ?? []) as unknown as LibraryWork[];
  } catch {
    configured = false;
  }

  const filteredWorks = sortLibraryWorks(allWorks.filter((work) => matchesLibraryFilters(work, filters)), filters.sort);
  const tags = getLibraryOptions(allWorks, "tags");
  const warnings = getLibraryOptions(allWorks, "content_warnings");
  const activeFilters = hasActiveLibraryFilters(filters);

  return <main className="shell section">
    <div className="section-head">
      <div><span className="eyebrow">The public shelves</span><h1 className="serif" style={{ fontSize: 48, fontWeight: 400, margin: "10px 0" }}>The library</h1></div>
      <span className="muted">{filteredWorks.length} {filteredWorks.length === 1 ? "story" : "stories"}</span>
    </div>

    <form method="get" className="actions" role="search" style={{ margin: "0 0 16px", alignItems: "end" }}>
      <div>
        <label htmlFor="q" className="muted">Search stories, authors, or tags</label>
        <input id="q" name="q" defaultValue={filters.q} placeholder="A title or a feeling…" style={{ minWidth: 260, background: "var(--panel)", border: "1px solid var(--line)", color: "var(--cream)", padding: 12, borderRadius: 4 }} />
      </div>
      <div>
        <label htmlFor="tag" className="muted">Tag</label>
        <select id="tag" name="tag" defaultValue={filters.tag} style={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--cream)", padding: 12, borderRadius: 4 }}>
          <option value="">All tags</option>
          {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="warning" className="muted">Content notes</label>
        <select id="warning" name="warning" defaultValue={filters.warning} style={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--cream)", padding: 12, borderRadius: 4 }}>
          <option value="">Any content notes</option>
          {warnings.map((warning) => <option key={warning} value={warning}>{warning}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="sort" className="muted">Sort</label>
        <select id="sort" name="sort" defaultValue={filters.sort} style={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--cream)", padding: 12, borderRadius: 4 }}>
          {Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <button className="pill" type="submit">Apply filters</button>
      {activeFilters && <Link className="text-action" href="/library">Clear all</Link>}
    </form>

    {activeFilters && configured && <div className="actions" aria-label="Active filters" style={{ margin: "0 0 26px" }}>
      {filters.q && <span className="tag">Search: {filters.q} <Link href={filterHref(filters, "q")} aria-label="Remove search filter">×</Link></span>}
      {filters.tag && <span className="tag">Tag: {filters.tag} <Link href={filterHref(filters, "tag")} aria-label="Remove tag filter">×</Link></span>}
      {filters.warning && <span className="tag">Content note: {filters.warning} <Link href={filterHref(filters, "warning")} aria-label="Remove content note filter">×</Link></span>}
      {filters.sort !== "newest" && <span className="tag">Sort: {sortLabels[filters.sort]}</span>}
    </div>}

    {!configured && <p className="notice">Connect your Supabase project to open the shelves.</p>}
    {configured && allWorks.length === 0 && <div className="card"><h2 className="serif">A little quiet on these shelves.</h2><p>Published public stories will find their home here. Be the first to add yours.</p><Link href="/auth" className="pill primary">Write the first story</Link></div>}
    {configured && allWorks.length > 0 && filteredWorks.length === 0 && <div className="card"><h2 className="serif">Nothing matches these filters.</h2><p>Try a different author, tag, content note, or search phrase.</p><Link href="/library" className="pill primary">Clear filters</Link></div>}

    <div className="cards">{filteredWorks.map((work) => <article className="card" key={work.id}>
      <div className="actions" style={{ justifyContent: "space-between", marginBottom: 12 }}><span className="tag">Story</span>{work.tags[0] && <span className="muted">{work.tags[0]}</span>}</div>
      <Link href={`/work/${work.id}`}><h3>{work.title}</h3></Link>
      <p>{work.summary || "A new story begins here."}</p>
      {work.tags.length > 0 && <div className="actions" aria-label={`Tags for ${work.title}`}>{work.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>}
      <span className="byline">By <Link href={`/author/${work.profiles?.username}`}>{work.profiles?.display_name ?? "A reader"}</Link></span>
    </article>)}</div>
  </main>;
}
