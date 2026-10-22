"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { deleteChapter, duplicateChapter, publishChapter, reorderChapter, unpublishChapter } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function ChapterActionsMenu({ workId, chapterId, title, state, hasDraft, index, count }: {
  workId: string;
  chapterId: string;
  title: string;
  state: "draft" | "published";
  hasDraft: boolean;
  index: number;
  count: number;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
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
      <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label={`Actions for ${title}`} disabled={pending}><MoreHorizontal/></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end"><DropdownMenuGroup>
        <DropdownMenuItem disabled={pending || index === 0} onSelect={() => run(reorderChapter, "up")}>Move up</DropdownMenuItem>
        <DropdownMenuItem disabled={pending || index === count - 1} onSelect={() => run(reorderChapter, "down")}>Move down</DropdownMenuItem>
        <DropdownMenuItem disabled={pending} onSelect={() => run(state === "published" && !hasDraft ? unpublishChapter : publishChapter)}>{state === "published" ? hasDraft ? "Publish revision" : "Unpublish" : "Publish"}</DropdownMenuItem>
        <DropdownMenuItem disabled={pending} onSelect={() => run(duplicateChapter)}>Duplicate</DropdownMenuItem>
        {state === "draft" && <><DropdownMenuSeparator/><DropdownMenuItem disabled={pending} variant="destructive" onSelect={() => setDeleteOpen(true)}>Delete draft</DropdownMenuItem></>}
      </DropdownMenuGroup></DropdownMenuContent>
    </DropdownMenu>
    {state === "draft" && <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete draft chapter?</AlertDialogTitle><AlertDialogDescription>Permanently delete “{title}”? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><form action={deleteChapter}><input type="hidden" name="workId" value={workId}/><input type="hidden" name="chapterId" value={chapterId}/><input type="hidden" name="draftOnly" value="1"/><Button type="submit" variant="destructive">Delete draft</Button></form></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>}
  </>;
}
