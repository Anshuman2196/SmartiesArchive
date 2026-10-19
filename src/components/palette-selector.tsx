"use client";

import { useEffect, useState } from "react";

export const palettes = [
  { id: "original", label: "Original — Sage + Lime" },
  { id: "royal", label: "Royal Blue + Black" },
  { id: "wine", label: "Red Wine + Black" },
] as const;
export type PaletteId = (typeof palettes)[number]["id"];

export function PaletteSelector() {
  const [palette, setPalette] = useState<PaletteId>("original");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("smarties-palette");
      if (saved === "royal" || saved === "wine" || saved === "original") setPalette(saved);
    } catch { /* Keep the default if storage is unavailable. */ }
  }, []);
  useEffect(() => { document.documentElement.dataset.palette = palette; }, [palette]);
  const select = (value: string) => {
    if (value !== "original" && value !== "royal" && value !== "wine") return;
    setPalette(value);
    try { localStorage.setItem("smarties-palette", value); } catch { /* Theme remains active for this visit. */ }
  };
  return <label className="palette-select-label"><span className="sr-only">Application color palette</span><select aria-label="Application color palette" value={palette} onChange={(event) => select(event.target.value)}>{palettes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>;
}
