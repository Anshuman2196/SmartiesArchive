import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/site-origin";

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin();
  return { rules: { userAgent: "*", allow: ["/", "/work/", "/author/"], disallow: ["/admin", "/studio", "/shelf", "/auth"] }, sitemap: `${origin}/sitemap.xml` };
}
