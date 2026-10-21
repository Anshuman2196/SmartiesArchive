import type { PublishChecklistItem } from "@/lib/publishing-checklist";
import styles from "./publish-checklist.module.css";

const toneLabel = { ready: "Ready", warning: "Review", blocking: "Needs attention" } as const;

export function PublishChecklist({ items }: { items: PublishChecklistItem[] }) {
  const blocking = items.filter((item) => item.tone === "blocking").length;
  const review = items.filter((item) => item.tone === "warning").length;
  const summary = blocking ? `${blocking} ${blocking === 1 ? "item needs" : "items need"} attention` : review ? `${review} ${review === 1 ? "item" : "items"} to review` : "Ready to publish";
  return <details className={styles.checklist} open={blocking > 0}>
    <summary className={styles.heading}><div><span className="eyebrow">Before you publish</span><strong>A quick final check</strong></div><span className={styles.overview}>{summary}</span></summary>
    <ul className={styles.list}>
      {items.map((item) => <li key={item.id} className={styles.item} data-tone={item.tone}>
        <span className={styles.status} aria-label={toneLabel[item.tone]}>{item.tone === "ready" ? "✓" : item.tone === "blocking" ? "!" : "·"}</span>
        <div><strong>{item.label}</strong><p>{item.detail}</p></div>
      </li>)}
    </ul>
  </details>;
}
