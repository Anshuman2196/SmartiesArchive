import type { SupabaseClient } from "@supabase/supabase-js";

export type UserAction = "reader_progress" | "image_upload" | "pdf_upload" | "chapter_create" | "review_write";

let warnedAboutUnavailableLimiter = false;

export async function consumeUserActionRateLimit(supabase: SupabaseClient, action: UserAction): Promise<boolean> {
  const { data, error } = await supabase.rpc("consume_user_action_rate_limit", { p_action: action });
  if (error) {
    // Keep current deployments working until the owner applies the matching migration.
    const migrationNotApplied = error.code === "PGRST202" || error.code === "42883";
    if (!warnedAboutUnavailableLimiter) {
      warnedAboutUnavailableLimiter = true;
      console.warn("[action-rate-limit] limiter unavailable", { code: error.code ?? "unknown" });
    }
    return migrationNotApplied;
  }
  return data === true;
}
