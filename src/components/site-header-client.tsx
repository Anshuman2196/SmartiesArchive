"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bookmark, LogOut, Menu, PenLine, ShieldCheck, X } from "lucide-react";
import { signOut, type AuthActionState } from "@/app/actions";
import { PaletteSelector } from "@/components/palette-selector";
import { cancelReaderStateSignOutCleanup, markReaderStateForSignOutCleanup } from "@/lib/reader-local-state";

export function AuthNavigation({ username, displayName, isAdmin }: { username?: string; displayName: string; isAdmin: boolean }) {
  const [state, action, pending] = useActionState(signOut, { kind: "idle" } satisfies AuthActionState);
  useEffect(() => {
    if (state.kind === "error") cancelReaderStateSignOutCleanup();
  }, [state.kind]);
  return <><Link href={username ? `/author/${username}` : "/studio"} className="nav-profile" data-tooltip={`Your profile · ${username || displayName}`}><span className="avatar" aria-hidden="true">{(displayName || username || "W").slice(0, 1).toUpperCase()}</span><span className="sr-only">{username || displayName}</span></Link><Link href="/shelf" className="nav-icon" aria-label="My shelf" data-tooltip="My shelf"><Bookmark size={18} aria-hidden="true"/></Link><Link href="/studio" className="nav-icon" aria-label="Creator Studio" data-tooltip="Creator Studio"><PenLine size={18} aria-hidden="true"/></Link>{isAdmin && <Link href="/admin" className="nav-icon" aria-label="Admin" data-tooltip="Admin"><ShieldCheck size={18} aria-hidden="true"/></Link>}<form action={action} onSubmit={markReaderStateForSignOutCleanup}><button type="submit" className="nav-icon nav-signout" disabled={pending} aria-label={pending ? "Signing out" : "Sign out"} data-tooltip="Sign out"><LogOut size={18} aria-hidden="true"/></button></form>{state.kind === "error" && <span className="nav-error" role="alert">{state.message}</span>}</>;
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
    if (state.kind === "error") cancelReaderStateSignOutCleanup();
  }, [state.kind]);

  useEffect(() => {
    if (open) firstLinkRef.current?.focus();
    else if (wasOpenRef.current) toggleRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    const closeOnEscapeOrResize = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) setOpen(false);
    };
    const closeOnDesktop = () => { if (window.innerWidth > 850) setOpen(false); };
    window.addEventListener("keydown", closeOnEscapeOrResize);
    window.addEventListener("resize", closeOnDesktop);
    return () => {
      window.removeEventListener("keydown", closeOnEscapeOrResize);
      window.removeEventListener("resize", closeOnDesktop);
    };
  }, [open]);

  const close = () => setOpen(false);
  const accountLabel = displayName || username || "Writer";

  return <div className="mobile-nav"><button ref={toggleRef} type="button" className="mobile-nav-toggle" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen((value) => !value)}>{open ? <X size={20} aria-hidden="true"/> : <Menu size={20} aria-hidden="true"/>}<span className="sr-only">{open ? "Close" : "Open"} navigation</span></button><div id="mobile-navigation" className="mobile-menu" data-open={open} aria-hidden={!open} inert={!open}><div className="mobile-menu-panel"><Link ref={firstLinkRef} href="/library" onClick={close}>Library</Link><PaletteSelector/>{displayName || username ? <><Link href={username ? `/author/${username}` : "/studio"} onClick={close}><span className="avatar" aria-hidden="true">{accountLabel.slice(0, 1).toUpperCase()}</span>{username || accountLabel}</Link><Link href="/shelf" onClick={close}>My shelf</Link><Link href="/studio" onClick={close}>Creator Studio</Link>{isAdmin && <Link href="/admin" onClick={close}>Admin</Link>}<form action={action} onSubmit={markReaderStateForSignOutCleanup}><button type="submit" className="nav-signout" disabled={pending}>{pending ? "Signing out…" : "Sign out"}</button></form></> : <><Link href="/auth?mode=login" onClick={close}>Sign in</Link><Link href="/auth?mode=signup" className="pill primary" onClick={close}>Create account</Link></>}{state.kind === "error" && <span className="nav-error" role="alert">{state.message}</span>}</div></div></div>;
}
