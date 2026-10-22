"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearReaderStateAfterSignOut } from "@/lib/reader-local-state";

const progressKeyPrefix = "smarties-reading:";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type GuestProgress = { chapterId?: unknown; progress?: unknown; savedAt?: unknown };

export function HomeContinueLink({ signedIn }: { signedIn: boolean }) {
  const [guestDestination, setGuestDestination] = useState<{ href: string; label: string } | null>(null);

  useEffect(() => {
    clearReaderStateAfterSignOut();
    if (signedIn) return;
    try {
      let latest: { href: string; savedAt: number } | null = null;
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith(progressKeyPrefix)) continue;
        const workId = key.slice(progressKeyPrefix.length);
        if (!uuidPattern.test(workId)) continue;
        const state = JSON.parse(localStorage.getItem(key) ?? "null") as GuestProgress | null;
        if (!state || typeof state.chapterId !== "string" || !uuidPattern.test(state.chapterId)) continue;
        if (typeof state.progress !== "number" || !Number.isFinite(state.progress) || state.progress < 0 || state.progress > 1) continue;
        const savedAt = typeof state.savedAt === "number" && Number.isFinite(state.savedAt) ? state.savedAt : 0;
        if (!latest || savedAt > latest.savedAt) latest = { href: `/work/${workId}/chapter/${state.chapterId}`, savedAt };
      }
      setGuestDestination(latest ? { href: latest.href, label: "Continue reading" } : { href: "/library", label: "Start reading" });
    } catch {
      setGuestDestination({ href: "/library", label: "Start reading" });
    }
  }, [signedIn]);

  const href = signedIn ? "/shelf" : guestDestination?.href ?? "/library";
  const label = signedIn ? "Continue reading" : guestDestination?.label ?? "Continue reading";
  return <Link href={href} className="cinema-secondary">{label}</Link>;
}
