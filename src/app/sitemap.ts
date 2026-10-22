import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("works").select("id,updated_at").eq("visibility", "public").eq("state", "published").order("updated_at", { ascending: false });
    return [
      { url: origin, changeFrequency: "weekly", priority: 1 },
      { url: `${origin}/library`, changeFrequency: "daily", priority: 0.9 },
      ...(data ?? []).map((work) => ({ url: `${origin}/work/${work.id}`, lastModified: work.updated_at, changeFrequency: "weekly" as const, priority: 0.7 })),
    ];
  } catch {
    return [{ url: origin, changeFrequency: "weekly", priority: 1 }, { url: `${origin}/library`, changeFrequency: "daily", priority: 0.9 }];
  }
}
