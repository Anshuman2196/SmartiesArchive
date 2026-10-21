import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = { title: "Smarties Archive — Stories that stay with you", description: "A quiet corner of the internet for stories worth keeping." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to main content</a><SiteHeader/><div id="main-content" tabIndex={-1}>{children}</div><footer className="footer" aria-label="Site footer"><div className="shell">An archive for the stories we carry with us.</div></footer></body></html>;
}
