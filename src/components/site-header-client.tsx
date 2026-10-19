"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signOut, type AuthActionState } from "@/app/actions";

export function AuthNavigation({ username, displayName }: { username?: string; displayName: string }) {
  const [state, action, pending] = useActionState(signOut, { kind: "idle" } satisfies AuthActionState);
  return <><Link href={username ? `/author/${username}` : "/studio"} className="nav-profile"><span className="avatar" aria-hidden="true">{(displayName || username || "W").slice(0, 1).toUpperCase()}</span><span>{username || displayName}</span></Link><Link href="/studio" className="optional">Creator studio</Link><form action={action}><button type="submit" className="nav-signout" disabled={pending}>{pending ? "Signing out…" : "Sign out"}</button></form>{state.kind === "error" && <span className="nav-error" role="alert">{state.message}</span>}</>;
}
