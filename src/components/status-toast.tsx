"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

// Shows a server-redirect status as a toast, then drops the status parameter so a refresh does not repeat it.
export function StatusToast({ message, error, hrefWithoutStatus }: { message: string; error?: boolean; hrefWithoutStatus?: string }) {
  const router = useRouter();
  useEffect(() => {
    (error ? toast.error : toast.success)(message, { id: `status:${message}` });
    if (hrefWithoutStatus) router.replace(hrefWithoutStatus, { scroll: false });
  }, [error, hrefWithoutStatus, message, router]);
  return null;
}
