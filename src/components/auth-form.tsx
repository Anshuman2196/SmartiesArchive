"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { register, requestPasswordReset, resendConfirmation, signIn, type AuthActionState } from "@/app/actions";

type Mode = "login" | "signup" | "recover";
const idle: AuthActionState = { kind: "idle" };

function PasswordField({ id, label, name, autoComplete, error, required = true }: { id: string; label: string; name: string; autoComplete: string; error?: string; required?: boolean }) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  return <div className="field"><label htmlFor={id}>{label}</label><div className="password-control"><input id={id} name={name} type={visible ? "text" : "password"} required={required} minLength={name === "password" && autoComplete === "new-password" ? 10 : undefined} maxLength={128} autoComplete={autoComplete} aria-invalid={!!error} aria-describedby={error ? errorId : undefined}/><button type="button" className="password-toggle" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible((value) => !value)}>{visible ? "Hide" : "Show"}</button></div>{error && <span id={errorId} className="field-error">{error}</span>}</div>;
}

function Feedback({ state }: { state: AuthActionState }) {
  if (!state.message) return null;
  return <p className={state.kind === "error" ? "notice auth-error" : "notice auth-success"} role={state.kind === "error" ? "alert" : "status"} aria-live={state.kind === "error" ? "assertive" : "polite"}>{state.message}</p>;
}

export function AuthForm({ mode, statusMessage, next }: { mode: Mode; statusMessage?: string; next: string }) {
  const [loginState, loginAction, loginPending] = useActionState(signIn, idle);
  const [signupState, signupAction, signupPending] = useActionState(register, idle);
  const [recoveryState, recoveryAction, recoveryPending] = useActionState(requestPasswordReset, idle);
  const [resendState, resendAction, resendPending] = useActionState(resendConfirmation, idle);
  const state = mode === "login" ? loginState : mode === "signup" ? signupState : recoveryState;

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("status") && !url.searchParams.has("error") && !url.searchParams.has("message")) return;
    url.searchParams.delete("status");
    url.searchParams.delete("error");
    url.searchParams.delete("message");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const modeLink = (target: Mode) => {
    const query = new URLSearchParams({ mode: target });
    if (next !== "/studio") query.set("next", next);
    return `/auth?${query.toString()}`;
  };
  return <main id="main-content" tabIndex={-1} className="shell auth-shell">
    <section className="auth-panel" aria-labelledby="auth-title">
      {mode === "recover" ? <>
        <Link href={modeLink("login")} className="auth-back"><ArrowLeft size={15} aria-hidden="true"/> Back to sign in</Link>
        <span className="eyebrow">A fresh start</span><h1 id="auth-title" className="serif">Reset your password.</h1><p className="muted">We’ll email you a secure link to choose a new password.</p>
        {statusMessage && <p className="notice" role="status">{statusMessage}</p>}<Feedback state={recoveryState}/>
        <form action={recoveryAction} className="auth-form"><input type="hidden" name="next" value={next}/><div className="field"><label htmlFor="recover-email">Email address</label><input id="recover-email" name="email" type="email" required maxLength={254} autoComplete="email" aria-invalid={!!recoveryState.fields?.email} aria-describedby={recoveryState.fields?.email ? "recover-email-error" : undefined}/>{recoveryState.fields?.email && <span id="recover-email-error" className="field-error">{recoveryState.fields.email}</span>}</div><button className="pill primary auth-submit" type="submit" disabled={recoveryPending}>{recoveryPending && <span className="spinner" aria-hidden="true"/>}{recoveryPending ? "Sending link…" : "Send recovery link"}</button></form>
      </> : <>
        <span className="eyebrow">Smarties Archive / Account</span><h1 id="auth-title" className="serif">{mode === "signup" ? "Create account." : "Sign in."}</h1><p className="muted">{mode === "signup" ? "Save stories, keep your reading place, and publish your work." : "Return to your shelf and Creator Studio."}</p>
        <div className="auth-tabs" aria-label="Account options"><Link href={modeLink("login")} aria-current={mode === "login" ? "page" : undefined}>Sign in</Link><Link href={modeLink("signup")} aria-current={mode === "signup" ? "page" : undefined}>Create account</Link></div>
        {statusMessage && <p className="notice" role="status">{statusMessage}</p>}
        {!(mode === "signup" && signupState.kind === "success") && <Feedback state={state}/>}
        {mode === "signup" ? <>
          {signupState.kind !== "success" ? <form action={signupAction} className="auth-form"><input type="hidden" name="next" value={next}/>
            <div className="field"><label htmlFor="displayName">Name</label><input id="displayName" name="displayName" required maxLength={60} autoComplete="name" aria-invalid={!!signupState.fields?.displayName} aria-describedby={signupState.fields?.displayName ? "displayName-error" : undefined}/>{signupState.fields?.displayName && <span id="displayName-error" className="field-error">{signupState.fields.displayName}</span>}</div>
            <div className="field"><label htmlFor="username">Username</label><input id="username" name="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" autoComplete="username" aria-invalid={!!signupState.fields?.username} aria-describedby={signupState.fields?.username ? "username-error" : undefined}/><span className="field-hint">3–24 letters, numbers, or underscores.</span>{signupState.fields?.username && <span id="username-error" className="field-error">{signupState.fields.username}</span>}</div>
            <div className="field"><label htmlFor="signup-email">Email address</label><input id="signup-email" name="email" type="email" required maxLength={254} autoComplete="email" aria-invalid={!!signupState.fields?.email} aria-describedby={signupState.fields?.email ? "signup-email-error" : undefined}/>{signupState.fields?.email && <span id="signup-email-error" className="field-error">{signupState.fields.email}</span>}</div>
            <PasswordField id="signup-password" name="password" label="Password" autoComplete="new-password" error={signupState.fields?.password}/><span className="field-hint requirement">Use at least 10 characters.</span>
            <PasswordField id="signup-confirmation" name="confirmation" label="Confirm password" autoComplete="new-password" error={signupState.fields?.confirmation}/>
            <button className="pill primary auth-submit" type="submit" disabled={signupPending}>{signupPending && <span className="spinner" aria-hidden="true"/>}{signupPending ? "Creating your account…" : "Create account"}</button>
          </form> : <div className="confirmation-card"><span className="confirmation-mark" aria-hidden="true">✳</span><h2 className="serif">Check your email.</h2><p>{signupState.message}</p>{signupState.email && <p className="confirmation-email">{signupState.email}</p>}<form action={resendAction}><input type="hidden" name="email" value={signupState.email ?? ""}/><input type="hidden" name="next" value={next}/><button className="text-action" type="submit" disabled={resendPending}>{resendPending ? "Sending a fresh link…" : "Resend confirmation email"}</button></form><Feedback state={resendState}/><Link href={modeLink("login")} className="pill auth-submit">Return to sign in</Link></div>}
          <p className="auth-footnote">You may need to confirm your email address before signing in.</p>
        </> : <form action={loginAction} className="auth-form"><input type="hidden" name="next" value={next}/>
          <div className="field"><label htmlFor="login-email">Email address</label><input id="login-email" name="email" type="email" required maxLength={254} autoComplete="email" aria-invalid={!!loginState.fields?.email} aria-describedby={loginState.fields?.email ? "login-email-error" : undefined}/>{loginState.fields?.email && <span id="login-email-error" className="field-error">{loginState.fields.email}</span>}</div>
          <PasswordField id="login-password" name="password" label="Password" autoComplete="current-password" error={loginState.fields?.password}/>
          <div className="auth-inline"><Link href={modeLink("recover")} className="text-action">Forgot password?</Link></div>
          <button className="pill primary auth-submit" type="submit" disabled={loginPending}>{loginPending && <span className="spinner" aria-hidden="true"/>}{loginPending ? "Signing you in…" : "Sign in"}</button>
        </form>}
      </>}
    </section>
  </main>;
}
