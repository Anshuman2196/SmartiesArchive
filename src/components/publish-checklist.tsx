import type { PublishChecklistItem } from "@/lib/publishing-checklist";
import styles from "./publish-checklist.module.css";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const toneLabel = { ready: "Ready", warning: "Review", blocking: "Needs attention" } as const;

export function PublishChecklist({ items }: { items: PublishChecklistItem[] }) {
  const blocking = items.filter((item) => item.tone === "blocking").length;
  const review = items.filter((item) => item.tone === "warning").length;
  const summary = blocking ? `${blocking} ${blocking === 1 ? "item needs" : "items need"} attention` : review ? `${review} ${review === 1 ? "item" : "items"} to review` : "Ready to publish";
  return <div className="studio-publish-status">
    {blocking > 0 && <Alert><AlertTitle>Before publishing</AlertTitle><AlertDescription>{summary}. Open the checks to see what needs to change.</AlertDescription></Alert>}
    <Dialog><DialogTrigger asChild><Button variant="outline" size="sm">Publishing checks · {summary}</Button></DialogTrigger><DialogContent className="studio-publish-dialog"><DialogHeader><DialogTitle>Before you publish</DialogTitle><DialogDescription>Review the story and its chapters before readers see them.</DialogDescription></DialogHeader><ul className={styles.list}>
      {items.map((item) => <li key={item.id} className={styles.item} data-tone={item.tone}>
        <span className={styles.status} aria-label={toneLabel[item.tone]}>{item.tone === "ready" ? "✓" : item.tone === "blocking" ? "!" : "·"}</span>
        <div><strong>{item.label}</strong><p>{item.detail}</p></div>
      </li>)}
    </ul></DialogContent></Dialog>
  </div>;
}
