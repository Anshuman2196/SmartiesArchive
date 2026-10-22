"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { acceptStoryContentWarning } from "@/app/actions";
import { defaultReaderPreferences, normalizeReaderPreferences, type ReaderPreferences } from "@/lib/reader-state";
import styles from "./reader-experience.module.css";

export function ContentWarningGate({ workId, chapterId, title, warnings, preview }: { workId: string; chapterId: string; title: string; warnings: string[]; preview?: "draft" }) {
  const [theme, setTheme] = useState<ReaderPreferences["theme"]>(defaultReaderPreferences.theme);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("smarties-reader-preferences");
      if (stored) setTheme(normalizeReaderPreferences(JSON.parse(stored)).theme);
    } catch { /* Keep the readable default if local preferences are unavailable. */ }
  }, []);

  return <main className={`reader-page ${styles.readerPage}`} data-theme={theme}>
    <section className={styles.warningGate} aria-labelledby="reader-warning-title">
      <span className="eyebrow">Content notes</span>
      <h1 id="reader-warning-title" className="serif">Before you open {title}</h1>
      <p>This chapter includes content notes chosen by the author. Take care of yourself and continue only if you are comfortable.</p>
      <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      <div className="story-actions"><form action={acceptStoryContentWarning}><input type="hidden" name="workId" value={workId}/><input type="hidden" name="chapterId" value={chapterId}/>{preview && <input type="hidden" name="preview" value={preview}/>}<button type="submit" className="pill primary">I understand, continue</button></form><Link className="pill" href={`/work/${workId}`}>Back to story details</Link></div>
    </section>
  </main>;
}
