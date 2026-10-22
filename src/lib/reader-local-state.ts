"use client";

const signOutCleanupKey = "smarties-clear-reader-state-on-signout";

export function markReaderStateForSignOutCleanup() {
  try { window.sessionStorage.setItem(signOutCleanupKey, "1"); } catch { /* Best effort. */ }
}

export function clearReaderStateAfterSignOut() {
  try {
    if (window.sessionStorage.getItem(signOutCleanupKey) !== "1") return;
    window.localStorage.removeItem("smarties-reader-preferences");
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith("smarties-reading:") || key?.startsWith("smarties-warning:")) window.localStorage.removeItem(key);
    }
  } catch { /* Browser storage can be unavailable. */ }
  try { window.sessionStorage.removeItem(signOutCleanupKey); } catch { /* Best effort. */ }
}

export function cancelReaderStateSignOutCleanup() {
  try { window.sessionStorage.removeItem(signOutCleanupKey); } catch { /* Best effort. */ }
}
