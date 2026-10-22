import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return <main id="main-content" tabIndex={-1} className={styles.page} aria-labelledby="not-found-title">
    <div className={styles.visual} aria-hidden="true"/>
    <div className={`shell ${styles.content}`}><span className="eyebrow">404 / Page missing</span><h1 id="not-found-title">This scene is missing.</h1><p>That page is no longer in the archive, or the link has changed. You can still find a story to read.</p><div className={styles.actions}><Link href="/library" className="pill primary">Browse stories</Link><Link href="/" className={styles.homeLink}>Go home</Link></div></div>
  </main>;
}
