"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createWorkRecord } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function CreateWorkForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setStatus("Creating your story…");
    const result = await createWorkRecord(new FormData(event.currentTarget));
    if (!result.ok || !result.workId) {
      setPending(false);
      setStatus(result.message ?? "The story could not be created.");
      return;
    }
    router.push(`/studio/${result.workId}`);
    router.refresh();
  };

  return <form onSubmit={submit}>
    <input type="hidden" name="summary" value=""/>
    <input type="hidden" name="visibility" value="private"/>
    <FieldGroup><Field><FieldLabel htmlFor="title">Story title</FieldLabel><Input id="title" name="title" required maxLength={120} autoComplete="off" autoFocus/><FieldDescription>Your story starts as a private draft. Add the cover and publishing details later.</FieldDescription></Field></FieldGroup>
    {status && <p role="status" aria-live="polite" className="field-hint">{status}</p>}
    <Button className="studio-dialog-submit" type="submit" disabled={pending}>{pending ? "Creating…" : "Create story"}</Button>
  </form>;
}
