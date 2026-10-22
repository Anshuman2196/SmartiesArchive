export type AuthStatus = "callback_error" | "service_error" | "password_updated";

const authStatusMessages: Record<AuthStatus, string> = {
  callback_error: "We couldn’t verify that link. It may have expired or already been used; try signing in or request a fresh email link.",
  service_error: "We couldn’t reach the authentication service. Please try again in a moment.",
  password_updated: "Your password has been updated. You can now sign in with it.",
};

export function authStatusMessage(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string" || !(value in authStatusMessages)) return undefined;
  return authStatusMessages[value as AuthStatus];
}

export function safeNextPath(value: string | null | undefined, fallback = "/studio"): string {
  if (!value || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return fallback;
  try {
    const target = new URL(value, "https://smarties-archive.invalid");
    if (target.origin !== "https://smarties-archive.invalid" || !target.pathname.startsWith("/") || target.pathname.startsWith("//")) return fallback;
    if (target.pathname === "/auth" || target.pathname === "/auth/callback") return fallback;
    if ([...target.searchParams.keys()].some((key) => /(code|token|password|secret|session|credential|email)/i.test(key))) return fallback;
    return `${target.pathname}${target.search}`;
  } catch {
    return fallback;
  }
}

export function friendlyAuthError(error: unknown, purpose: "login" | "signup" | "recovery" | "confirmation" | "password" = "login"): string {
  const source = error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
  const text = source.toLowerCase();
  const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 0;
  if (status === 429 || /rate.?limit|too many requests/.test(text)) return "Too many attempts. Please wait a little while before trying again.";
  if (purpose === "signup" && /already registered|already exists|user_already_exists|email_exists/.test(text)) return "If this address is eligible for a new account, check your email for next steps. If you already have an account, sign in or reset your password.";
  if (/already registered|already exists|user_already_exists|email_exists/.test(text)) return "An account may already exist with this email. Try signing in or use password recovery.";
  if (/invalid login credentials|invalid credentials|email or password/.test(text)) return "Email or password could not be verified. If you just registered, confirm your email first.";
  if (/email.?not.?confirmed|email not verified/.test(text)) return "Confirm your email address using the link we sent before signing in.";
  if (/expired|invalid.*(token|link|otp)|token.*(expired|invalid)|otp_expired/.test(text)) return "That link is invalid or has expired. Request a fresh email link and try again.";
  if (/weak password|password should be/.test(text)) return "Choose a stronger password and try again.";
  if (/fetch failed|network|timeout|failed to fetch|offline/.test(text)) return "We couldn’t reach the authentication service. Check your connection and try again.";
  if (purpose === "login") return "We couldn’t sign you in. Check your details and try again.";
  if (purpose === "signup") return "We couldn’t create your account. Check your details and try again.";
  if (purpose === "recovery") return "We couldn’t send a recovery email right now. Please try again later.";
  if (purpose === "password") return "We couldn’t update your password. Check the requirements and try again.";
  return "We couldn’t verify that email link. Request a fresh link and try again.";
}
