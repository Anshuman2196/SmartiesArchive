"use client";

import { useEffect, useState } from "react";

export const palettes = [
  { id: "cinema", label: "Cinema" },
  { id: "archive", label: "Archive Night — Deep Water" },
  { id: "original", label: "Original — Sage + Lime" },
  { id: "royal", label: "Royal Blue + Black" },
  { id: "wine", label: "Red Wine + Black" },
] as const;
export type PaletteId = (typeof palettes)[number]["id"];

function readPalette(): PaletteId {
  if (typeof document !== "undefined") {
    const value = document.documentElement.dataset.palette;
    if (palettes.some((item) => item.id === value)) return value as PaletteId;
  }
  return "cinema";
}

export function PaletteSelector() {
  const [palette, setPalette] = useState<PaletteId>("cinema");
  useEffect(() => {
    const sync = () => setPalette(readPalette());
    sync();
    window.addEventListener("smarties-palette-change", sync);
    return () => window.removeEventListener("smarties-palette-change", sync);
  }, []);
  const select = (value: string) => {
    if (value !== "cinema" && value !== "archive" && value !== "original" && value !== "royal" && value !== "wine") return;
    setPalette(value);
    document.documentElement.dataset.palette = value;
    window.dispatchEvent(new Event("smarties-palette-change"));
    try { localStorage.setItem("smarties-palette", value); } catch { /* Theme remains active for this visit. */ }
  };
  return <label className="palette-select-label"><span>Theme</span><select aria-label="Application color palette" value={palette} onChange={(event) => select(event.target.value)}>{palettes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>;
}
