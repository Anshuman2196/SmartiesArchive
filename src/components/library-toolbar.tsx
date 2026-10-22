"use client";

import { useRef } from "react";
import type { LibraryFilters } from "@/lib/library-filters";

type Props = { filters: LibraryFilters; tags: string[]; warnings: string[] };

export function LibraryToolbar({ filters, tags, warnings }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const secondaryActive = Boolean(filters.tag || filters.warning || filters.excludeWarning || filters.sort !== "newest");
  const applySelection = () => formRef.current?.requestSubmit();

  return <form ref={formRef} method="get" className="library-toolbar" role="search">
    <div className="library-search-field"><label htmlFor="q">Search stories</label><input id="q" name="q" type="search" defaultValue={filters.q} placeholder="Title, author, or tag" /></div>
    <button className="pill primary" type="submit">Search</button>
    <details className="library-filter-details" open={secondaryActive}>
      <summary>Filter and sort{secondaryActive ? " · Active" : ""}</summary>
      <div className="library-filter-grid">
        <label htmlFor="tag">Tag<select id="tag" name="tag" defaultValue={filters.tag} onChange={applySelection}><option value="">All tags</option>{tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></label>
        <label htmlFor="warning">Content notes<select id="warning" name="warning" defaultValue={filters.warning} onChange={applySelection}><option value="">Any content notes</option>{warnings.map((warning) => <option key={warning} value={warning}>{warning}</option>)}</select></label>
        <label htmlFor="excludeWarning">Hide stories with<select id="excludeWarning" name="excludeWarning" defaultValue={filters.excludeWarning} onChange={applySelection}><option value="">No exclusions</option>{warnings.map((warning) => <option key={warning} value={warning}>{warning}</option>)}</select></label>
        <label htmlFor="sort">Sort<select id="sort" name="sort" defaultValue={filters.sort} onChange={applySelection}><option value="newest">Newest first</option><option value="updated">Recently updated</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select></label>
      </div>
    </details>
  </form>;
}
