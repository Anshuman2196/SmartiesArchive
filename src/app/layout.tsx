import type { Metadata } from "next";
import "@fontsource-variable/archivo";
import { SiteHeader } from "@/components/site-header";
import { getSiteOrigin } from "@/lib/site-origin";
import "./globals.css";
import "./refresh.css";

export const metadata: Metadata = { metadataBase: new URL(getSiteOrigin()), title: { default: "Smarties Archive — Stories that stay with you", template: "%s | Smarties Archive" }, description: "A quiet corner of the internet for stories worth keeping.", openGraph: { siteName: "Smarties Archive", type: "website", images: ["/images/archive-cover-default.webp"] } };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `try{var p=localStorage.getItem("smarties-palette");if(["cinema","archive","original","royal","wine"].includes(p))document.documentElement.dataset.palette=p}catch{}` }}/></head><body><a className="skip-link" href="#main-content">Skip to main content</a><SiteHeader/><div id="main-content" tabIndex={-1}>{children}</div><footer className="footer" aria-label="Site footer"><div className="shell">An archive for the stories we carry with us.</div></footer></body></html>;
}
