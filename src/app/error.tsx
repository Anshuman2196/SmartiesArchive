"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="shell section"><span className="eyebrow">A moment to reset</span><h1 className="serif">This page could not be opened.</h1><p className="muted">Your place in the archive is safe. Try loading this page again.</p><button type="button" className="pill primary" onClick={reset}>Try again</button></main>;
}
