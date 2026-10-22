export default function Loading() {
  return <main id="main-content" tabIndex={-1} className="shell section" aria-busy="true" aria-label="Loading page"><p className="eyebrow" role="status">Opening the archive…</p><div className="loading-surface" aria-hidden="true"/><div className="loading-surface loading-surface-short" aria-hidden="true"/></main>;
}
