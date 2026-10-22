import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthNavigation, MobileNavigation } from "@/components/site-header-client";
import { getCurrentUser } from "@/lib/supabase/current-user";

export async function SiteHeader() {
  let profile: { username?: string; display_name: string } | null = null;
  let isAdmin = false;
  try {
    const user = await getCurrentUser();
    if (user) {
      const supabase = await createClient();
      const [profileResult, adminResult] = await Promise.all([
        supabase.from("profiles").select("username,display_name").eq("id", user.id).maybeSingle(),
        supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle(),
      ]);
      const { data } = profileResult;
      profile = data ?? { username: typeof user.user_metadata?.username === "string" ? user.user_metadata.username : undefined, display_name: typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "Writer" };
      isAdmin = Boolean(adminResult.data);
    }
  } catch {
    // The public archive remains available when Supabase is unconfigured or temporarily unavailable.
  }
  return <header className="topbar"><nav className="shell nav" aria-label="Main navigation"><Link href="/" className="brand">smarties<span>archive</span></Link><div className="navlinks navlinks-desktop"><Link href="/library">Library</Link>{profile ? <AuthNavigation username={profile.username} displayName={profile.display_name} isAdmin={isAdmin}/> : <><Link href="/auth?mode=login">Sign in</Link><Link href="/auth?mode=signup" className="pill primary">Create account</Link></>}</div><MobileNavigation username={profile?.username} displayName={profile?.display_name} isAdmin={isAdmin}/></nav></header>;
}
