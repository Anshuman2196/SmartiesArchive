import test from "node:test";
import assert from "node:assert/strict";
import { authStatusMessage, friendlyAuthError, safeNextPath } from "./auth-feedback.ts";

test("auth status messages accept only known public status codes", () => {
  assert.match(authStatusMessage("callback_error") ?? "", /expired or already been used/i);
  assert.equal(authStatusMessage("raw-secret-error"), undefined);
  assert.equal(authStatusMessage(["callback_error"]), undefined);
});

test("post-auth destinations stay on this app and reject auth loops and secrets", () => {
  assert.equal(safeNextPath("/library?q=poetry"), "/library?q=poetry");
  assert.equal(safeNextPath("https://attacker.example/path"), "/studio");
  assert.equal(safeNextPath("//attacker.example/path"), "/studio");
  assert.equal(safeNextPath("/auth/callback?code=secret"), "/studio");
  assert.equal(safeNextPath("/library?email=reader@example.com"), "/studio");
  assert.equal(safeNextPath("/library#access_token=secret"), "/library");
  assert.equal(safeNextPath("/auth/reset"), "/auth/reset");
});

test("common auth failures map to safe friendly copy", () => {
  assert.match(friendlyAuthError({ message: "Invalid login credentials" }), /could not be verified/i);
  assert.match(friendlyAuthError({ message: "over_email_send_rate_limit", status: 429 }, "recovery"), /too many attempts/i);
  assert.match(friendlyAuthError({ message: "TypeError: fetch failed" }), /couldn’t reach/i);
  assert.doesNotMatch(friendlyAuthError(new Error("Database internal secret")), /Database|secret/i);
});
