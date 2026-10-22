"use client";

import { useEffect, useRef, useTransition, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import type { LibraryFilters } from "@/lib/library-filters";

type Props = { filters: LibraryFilters; tags: string[]; warnings: string[] };

export function LibraryToolbar({ filters, tags, warnings }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const secondaryActive = Boolean(filters.tags.length || filters.warning || filters.excludeWarning || filters.sort !== "newest");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  // Inputs are uncontrolled, so mirror URL changes made elsewhere (filter chips, Clear all) back into the form.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const selected = new Set(filters.tags.map((tag) => tag.toLocaleLowerCase()));
    form.querySelectorAll<HTMLInputElement>('input[name="tag"]').forEach((input) => { input.checked = selected.has(input.value.toLocaleLowerCase()); });
    const fields = form.elements as HTMLFormControlsCollection & Record<string, HTMLInputElement | HTMLSelectElement | undefined>;
    if (fields.q) fields.q.value = filters.q;
    if (fields.warning) fields.warning.value = filters.warning;
    if (fields.excludeWarning) fields.excludeWarning.value = filters.excludeWarning;
    if (fields.sort) fields.sort.value = filters.sort;
  }, [filters]);
  const applySelection = () => formRef.current?.requestSubmit();
  // Navigate client-side so filtering keeps scroll position and focus; empty fields stay out of the URL.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string" && value.trim() && !(key === "sort" && value === "newest")) params.append(key, value.trim());
    }
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  return <form ref={formRef} method="get" className="library-toolbar" role="search" onSubmit={submit} aria-busy={pending}>
    <div className="library-search-field"><label htmlFor="q">Search stories</label><input id="q" name="q" type="search" defaultValue={filters.q} placeholder="Title, author, or tag" /></div>
    <button className="pill primary library-search-submit" type="submit" aria-label="Search" data-tooltip="Search"><Search size={18} aria-hidden="true"/></button>
    <details className="library-filter-details" open={secondaryActive}>
      <summary data-tooltip="Filter by tag or content note, and change the sort order"><SlidersHorizontal size={16} aria-hidden="true"/>Filters{secondaryActive && <span className="library-filter-dot" aria-label="active"/>}</summary>
      <div className="library-filter-grid">
        {tags.length > 0 && <fieldset className="library-tag-options"><legend>Tags · match all selected</legend><div>{tags.map((tag) => <label key={tag}><input type="checkbox" name="tag" value={tag} defaultChecked={filters.tags.some((selected) => selected.toLocaleLowerCase() === tag.toLocaleLowerCase())} onChange={applySelection}/><span>{tag}</span></label>)}</div></fieldset>}
        <label htmlFor="warning">Content notes<select id="warning" name="warning" defaultValue={filters.warning} onChange={applySelection}><option value="">Any content notes</option>{warnings.map((warning) => <option key={warning} value={warning}>{warning}</option>)}</select></label>
        <label htmlFor="excludeWarning">Hide stories with<select id="excludeWarning" name="excludeWarning" defaultValue={filters.excludeWarning} onChange={applySelection}><option value="">No exclusions</option>{warnings.map((warning) => <option key={warning} value={warning}>{warning}</option>)}</select></label>
        <label htmlFor="sort">Sort<select id="sort" name="sort" defaultValue={filters.sort} onChange={applySelection}><option value="newest">Newest first</option><option value="updated">Recently updated</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select></label>
      </div>
    </details>
  </form>;
}
