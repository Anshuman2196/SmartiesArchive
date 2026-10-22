"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut, type AuthActionState } from "@/app/actions";
import { PaletteSelector } from "@/components/palette-selector";

export function AuthNavigation({ username, displayName, isAdmin }: { username?: string; displayName: string; isAdmin: boolean }) {
  const [state, action, pending] = useActionState(signOut, { kind: "idle" } satisfies AuthActionState);
  return <><Link href={username ? `/author/${username}` : "/studio"} className="nav-profile"><span className="avatar" aria-hidden="true">{(displayName || username || "W").slice(0, 1).toUpperCase()}</span><span>{username || displayName}</span></Link><Link href="/shelf" className="optional">My shelf</Link><Link href="/studio" className="optional">Creator studio</Link>{isAdmin && <Link href="/admin" className="optional">Admin</Link>}<form action={action}><button type="submit" className="nav-signout" disabled={pending}>{pending ? "Signing out…" : "Sign out"}</button></form>{state.kind === "error" && <span className="nav-error" role="alert">{state.message}</span>}</>;
}

export function MobileNavigation({ username, displayName, isAdmin }: { username?: string; displayName?: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const wasOpenRef = useRef(false);
  const [state, action, pending] = useActionState(signOut, { kind: "idle" } satisfies AuthActionState);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (open) firstLinkRef.current?.focus();
    else if (wasOpenRef.current) toggleRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    const closeOnEscapeOrResize = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) setOpen(false);
    };
    const closeOnDesktop = () => { if (window.innerWidth > 800) setOpen(false); };
    window.addEventListener("keydown", closeOnEscapeOrResize);
    window.addEventListener("resize", closeOnDesktop);
    return () => {
      window.removeEventListener("keydown", closeOnEscapeOrResize);
      window.removeEventListener("resize", closeOnDesktop);
    };
  }, [open]);

  const close = () => setOpen(false);
  const accountLabel = displayName || username || "Writer";

  return <div className="mobile-nav"><button ref={toggleRef} type="button" className="mobile-nav-toggle" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen((value) => !value)}><span className="mobile-nav-icon" aria-hidden="true"><i/><i/><i/></span><span className="sr-only">{open ? "Close" : "Open"} navigation</span></button><div id="mobile-navigation" className="mobile-menu" data-open={open} aria-hidden={!open}><div className="mobile-menu-panel"><Link ref={firstLinkRef} href="/library" onClick={close}>Library</Link><PaletteSelector/>{displayName || username ? <><Link href={username ? `/author/${username}` : "/studio"} onClick={close}><span className="avatar" aria-hidden="true">{accountLabel.slice(0, 1).toUpperCase()}</span>{username || accountLabel}</Link><Link href="/shelf" onClick={close}>My shelf</Link><Link href="/studio" onClick={close}>Creator studio</Link>{isAdmin && <Link href="/admin" onClick={close}>Admin</Link>}<form action={action}><button type="submit" className="nav-signout" disabled={pending}>{pending ? "Signing out…" : "Sign out"}</button></form></> : <><Link href="/auth?mode=login" onClick={close}>Sign in</Link><Link href="/auth?mode=signup" className="pill primary" onClick={close}>Join free</Link></>}{state.kind === "error" && <span className="nav-error" role="alert">{state.message}</span>}</div></div></div>;
}
