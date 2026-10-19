import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthNavigation } from "@/components/site-header-client";

export async function SiteHeader() {
  let profile: { username?: string; display_name: string } | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("username,display_name").eq("id", user.id).maybeSingle();
      profile = data ?? { username: typeof user.user_metadata?.username === "string" ? user.user_metadata.username : undefined, display_name: typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "Writer" };
    }
  } catch {
    // The public archive remains available when Supabase is unconfigured or temporarily unavailable.
  }
  return <header className="topbar"><nav className="shell nav" aria-label="Main navigation"><Link href="/" className="brand">smarties<span>archive</span></Link><div className="navlinks"><Link href="/library">Library</Link>{profile ? <AuthNavigation username={profile.username} displayName={profile.display_name}/> : <><Link href="/auth?mode=login">Sign in</Link><Link href="/auth?mode=signup" className="pill primary">Join free</Link></>}</div></nav></header>;
}
