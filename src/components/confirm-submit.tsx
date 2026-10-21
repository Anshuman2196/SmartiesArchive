"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function ConfirmSubmit({ children, phrase, className = "danger-button" }: { children: ReactNode; phrase: string; className?: string }) {
  const form = useRef<HTMLFormElement | null>(null);
  const rememberForm = (event: MouseEvent<HTMLButtonElement>) => { form.current = event.currentTarget.closest("form"); };
  return <AlertDialog>
    <AlertDialogTrigger asChild><button type="button" className={className} onClick={rememberForm}>{children}</button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Confirm this change</AlertDialogTitle><AlertDialogDescription>{phrase}</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => form.current?.requestSubmit()}>Confirm</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
