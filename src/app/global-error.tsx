"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body style={{ margin: 0, padding: "12vh 8vw", background: "#101010", color: "#f3f0e9", fontFamily: "Arial, sans-serif" }}><main><p style={{ color: "#ff765f", textTransform: "uppercase", letterSpacing: ".12em" }}>Smarties Archive</p><h1>This page could not be opened.</h1><p>Your place in the archive is safe. Try loading this page again.</p><button style={{ minHeight: 44, padding: "0 18px", cursor: "pointer" }} onClick={reset}>Try again</button></main></body></html>;
}
