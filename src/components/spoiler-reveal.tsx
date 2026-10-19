"use client";

import { useState, type ReactNode } from "react";

export function SpoilerReveal({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return <button
    type="button"
    className="reader-spoiler"
    data-revealed={revealed}
    aria-expanded={revealed}
    aria-label={revealed ? undefined : "Spoiler text hidden. Activate to reveal."}
    onClick={() => setRevealed((value) => !value)}
  ><span aria-hidden={!revealed}>{children}</span></button>;
}
