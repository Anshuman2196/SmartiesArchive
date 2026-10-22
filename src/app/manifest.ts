import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "Smarties Archive", short_name: "Smarties", description: "A quiet corner of the internet for stories worth keeping.", start_url: "/", display: "standalone", background_color: "#101010", theme_color: "#101010", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }] };
}
