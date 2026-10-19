import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "Smarties Archive — Stories that stay with you", description: "A quiet corner of the internet for stories worth keeping." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><header className="topbar"><nav className="shell nav" aria-label="Main navigation"><Link href="/" className="brand">smarties<span>archive</span></Link><div className="navlinks"><Link href="/library">Library</Link><Link href="/studio" className="optional">Creator studio</Link><Link href="/auth">Sign in</Link><Link href="/auth" className="pill primary">Join free</Link></div></nav></header>{children}<footer className="footer"><div className="shell">An archive for the stories we carry with us.</div></footer></body></html>;
}
