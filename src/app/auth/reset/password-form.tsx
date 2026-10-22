"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useActionState, useState } from "react";
import { updatePassword, type AuthActionState } from "@/app/actions";

export function PasswordUpdateForm() {
  const [state, action, pending] = useActionState(updatePassword, { kind: "idle" } satisfies AuthActionState);
  const [showPassword, setShowPassword] = useState(false);
  return <main id="main-content" tabIndex={-1} className="shell auth-shell auth-reset-shell"><section className="auth-panel" aria-labelledby="reset-title"><span className="eyebrow">New password</span><h1 id="reset-title" className="serif">Choose a new password.</h1><p id="password-requirements" className="muted">Use at least 10 characters. This replaces the password for your account.</p>
    {state.message && <p className={state.kind === "error" ? "notice auth-error" : "notice"} role={state.kind === "error" ? "alert" : "status"} aria-live="polite">{state.message}</p>}
    {state.kind === "success" ? <Link className="pill primary auth-submit" href="/studio">Continue to Creator Studio</Link> : <form action={action} className="auth-form" aria-busy={pending}><div className="field"><label htmlFor="new-password">New password</label><div className="password-control"><input id="new-password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={10} maxLength={128} required aria-invalid={!!state.fields?.password} aria-describedby={state.fields?.password ? "password-requirements new-password-error" : "password-requirements"}/><button className="password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} aria-hidden="true"/> : <Eye size={18} aria-hidden="true"/>}</button></div>{state.fields?.password && <span id="new-password-error" className="field-error">{state.fields.password}</span>}</div><div className="field"><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" name="confirmation" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={10} maxLength={128} required aria-invalid={!!state.fields?.confirmation} aria-describedby={state.fields?.confirmation ? "confirmation-password-error" : undefined}/>{state.fields?.confirmation && <span id="confirmation-password-error" className="field-error">{state.fields.confirmation}</span>}</div><button className="pill primary auth-submit" type="submit" disabled={pending}>{pending && <span className="spinner" aria-hidden="true"/>}{pending ? "Updating password…" : "Update password"}</button></form>}
    <p className="auth-terms"><Link href="/auth?mode=login">Return to sign in</Link></p></section></main>;
}
