"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { deleteChapter, discardChapterRevision, duplicateChapter, publishChapter, reorderChapter, unpublishChapter } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

function ConfirmActionSubmit({ children, pendingLabel }: { children: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="destructive" disabled={pending} aria-live="polite">{pending ? pendingLabel : children}</Button>;
}

export function ChapterActionsMenu({ workId, chapterId, title, state, hasDraft, index, count }: {
  workId: string;
  chapterId: string;
  title: string;
  state: "draft" | "published";
  hasDraft: boolean;
  index: number;
  count: number;
}) {
  const [confirmAction, setConfirmAction] = useState<"unpublish" | "discard" | "delete" | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: (data: FormData) => Promise<void>, direction?: "up" | "down") => {
    const data = new FormData();
    data.set("workId", workId);
    data.set("chapterId", chapterId);
    if (direction) data.set("direction", direction);
    startTransition(async () => { await action(data); });
  };

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button className="studio-chapter-actions-trigger" variant="outline" size="icon" aria-label={`Actions for ${title}`} disabled={pending}><MoreHorizontal/></Button></DropdownMenuTrigger>
      <DropdownMenuContent className="studio-chapter-actions-menu" align="end"><DropdownMenuGroup>
        <DropdownMenuItem disabled={pending || index === 0} onSelect={() => run(reorderChapter, "up")}>Move up</DropdownMenuItem>
        <DropdownMenuItem disabled={pending || index === count - 1} onSelect={() => run(reorderChapter, "down")}>Move down</DropdownMenuItem>
        {state === "published" && !hasDraft ? <DropdownMenuItem disabled={pending} onSelect={() => setConfirmAction("unpublish")}>Unpublish</DropdownMenuItem> : <DropdownMenuItem disabled={pending} onSelect={() => run(publishChapter)}>{state === "published" ? "Publish revision" : "Publish"}</DropdownMenuItem>}
        {state === "published" && hasDraft && <><DropdownMenuItem disabled={pending} onSelect={() => setConfirmAction("unpublish")}>Unpublish chapter</DropdownMenuItem><DropdownMenuItem disabled={pending} variant="destructive" onSelect={() => setConfirmAction("discard")}>Discard revision</DropdownMenuItem></>}
        <DropdownMenuItem disabled={pending} onSelect={() => run(duplicateChapter)}>Duplicate</DropdownMenuItem>
        <DropdownMenuSeparator/><DropdownMenuItem disabled={pending} variant="destructive" onSelect={() => setConfirmAction("delete")}>{state === "published" ? "Delete chapter" : "Delete draft"}</DropdownMenuItem>
      </DropdownMenuGroup></DropdownMenuContent>
    </DropdownMenu>
    {pending && <span className="chapter-action-pending" role="status" aria-live="polite">Saving chapter changes…</span>}
    <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirmAction === "unpublish" ? "Unpublish this chapter?" : confirmAction === "discard" ? "Discard this revision?" : state === "published" ? "Delete this published chapter?" : "Delete draft chapter?"}</AlertDialogTitle><AlertDialogDescription>{confirmAction === "unpublish" ? `Readers will no longer be able to open “${title}”. The chapter will remain saved as a draft.` : confirmAction === "discard" ? `Permanently discard unpublished changes to “${title}”? The published chapter remains available.` : state === "published" ? `Readers will immediately lose access to “${title}”. Its reviews, saved reading progress, and any unpublished revision will also be deleted. This cannot be undone.` : `Permanently delete “${title}”? This cannot be undone.`}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><form action={confirmAction === "unpublish" ? unpublishChapter : confirmAction === "discard" ? discardChapterRevision : deleteChapter}><input type="hidden" name="workId" value={workId}/><input type="hidden" name="chapterId" value={chapterId}/>{confirmAction === "delete" && state === "draft" && <input type="hidden" name="draftOnly" value="1"/>}<ConfirmActionSubmit pendingLabel={confirmAction === "unpublish" ? "Unpublishing…" : confirmAction === "discard" ? "Discarding…" : "Deleting…"}>{confirmAction === "unpublish" ? "Unpublish chapter" : confirmAction === "discard" ? "Discard revision" : state === "published" ? "Delete chapter" : "Delete draft"}</ConfirmActionSubmit></form></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
