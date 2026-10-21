import type { PublishChecklistItem } from "@/lib/publishing-checklist";
import styles from "./publish-checklist.module.css";

const toneLabel = { ready: "Ready", warning: "Review", blocking: "Needs attention" } as const;

export function PublishChecklist({ items }: { items: PublishChecklistItem[] }) {
  return <section className={styles.checklist} aria-labelledby="publish-checklist-title">
    <div className={styles.heading}><div><span className="eyebrow">Before you publish</span><h2 id="publish-checklist-title" className="serif">A quick final check.</h2></div><span className="muted">Review items do not block publishing.</span></div>
    <ul className={styles.list}>
      {items.map((item) => <li key={item.id} className={styles.item} data-tone={item.tone}>
        <span className={styles.status} aria-label={toneLabel[item.tone]}>{item.tone === "ready" ? "✓" : item.tone === "blocking" ? "!" : "·"}</span>
        <div><strong>{item.label}</strong><p>{item.detail}</p></div>
      </li>)}
    </ul>
  </section>;
}
