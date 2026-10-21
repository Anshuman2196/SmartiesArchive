"use client";

import Image from "next/image";
import { useState } from "react";
import { uploadStoryMediaFile } from "@/lib/client-story-upload";
import styles from "./manga-panel-picker.module.css";

type Panel = { src: string; previewSrc: string; alt: string };

function parsePanels(value: string): Panel[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [src, ...caption] = line.split("|");
    return { src: src.trim(), previewSrc: src.trim().startsWith("https://") ? src.trim() : "", alt: caption.join("|").trim() };
  });
}

function serializePanels(panels: Panel[]) {
  return panels.map((panel) => `${panel.src}|${panel.alt}`).join("\n");
}

export function MangaPanelPicker({ workId, initialValue = "" }: { workId: string; initialValue?: string }) {
  const [panels, setPanels] = useState(() => parsePanels(initialValue));
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const addFiles = async (files: FileList | null) => {
    const selected = Array.from(files ?? []).slice(0, Math.max(0, 100 - panels.length));
    if (!selected.length) return;
    setBusy(true);
    const added: Panel[] = [];
    for (const [index, file] of selected.entries()) {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > 8 * 1024 * 1024) {
        setStatus(`${file.name} was skipped. Use JPEG, PNG, WebP, or GIF files under 8 MB.`);
        continue;
      }
      setStatus(`Uploading manga page ${index + 1} of ${selected.length}…`);
      const result = await uploadStoryMediaFile(workId, file);
      if (result.ok && result.src) added.push({ src: result.src, previewSrc: result.previewSrc ?? URL.createObjectURL(file), alt: "" });
      else setStatus(result.message ?? `${file.name} could not be uploaded.`);
    }
    setPanels((current) => [...current, ...added]);
    setBusy(false);
    if (added.length) setStatus(`${added.length} manga page${added.length === 1 ? "" : "s"} ready. Add captions before saving.`);
  };

  const updatePanel = (index: number, patch: Partial<Panel>) => setPanels((current) => current.map((panel, panelIndex) => panelIndex === index ? { ...panel, ...patch } : panel));
  const movePanel = (index: number, direction: -1 | 1) => setPanels((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  return <div className={styles.picker}>
    <input type="hidden" name="content" value={serializePanels(panels)} required={panels.length === 0}/>
    <label className="pill upload-image-button">{busy ? "Uploading pages…" : "Add manga pages"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple disabled={busy || panels.length >= 100} onChange={(event) => { void addFiles(event.target.files); event.currentTarget.value = ""; }}/></label>
    <p className="field-hint">Add up to 100 pages. Pages upload as images and stay in their original format; no conversion is performed.</p>
    {status && <p className="field-hint" role="status" aria-live="polite">{status}</p>}
    {panels.length === 0 ? <p className="notice">No manga pages added yet.</p> : <ol className={styles.pages}>{panels.map((panel, index) => <li className={styles.page} key={`${panel.src}-${index}`}>
      {panel.previewSrc ? <Image className={styles.preview} src={panel.previewSrc} width={88} height={112} unoptimized alt={panel.alt || `Manga page ${index + 1} preview`}/> : <div className={styles.placeholder}>Preview unavailable</div>}
      <div className={styles.pageFields}><span className={styles.pageNumber}>Page {index + 1}</span><label>Alt text<input value={panel.alt} maxLength={300} onChange={(event) => updatePanel(index, { alt: event.target.value })}/></label></div>
      <div className={styles.pageActions}><button type="button" className="text-action" onClick={() => movePanel(index, -1)} disabled={index === 0} aria-label={`Move page ${index + 1} up`}>Move up</button><button type="button" className="text-action" onClick={() => movePanel(index, 1)} disabled={index === panels.length - 1} aria-label={`Move page ${index + 1} down`}>Move down</button><button type="button" className="text-action" onClick={() => setPanels((current) => current.filter((_, panelIndex) => panelIndex !== index))}>Remove</button></div>
    </li>)}</ol>}
  </div>;
}
