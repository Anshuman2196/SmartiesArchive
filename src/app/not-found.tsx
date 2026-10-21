import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return <main className={`shell ${styles.page}`} aria-labelledby="not-found-title">
    <div className={styles.inner}>
      <div className={styles.archiveCard} aria-hidden="true">
        <div className={styles.cardTop}><span>SMARTIES</span><span>ARCHIVE / 404</span></div>
        <div className={styles.cardCore}><span className={styles.cardNumber}>04</span><span className={styles.cardSlash}>/</span><span className={styles.cardNumber}>04</span></div>
        <div className={styles.cardRule}/>
        <div className={styles.cardBottom}><span>NO RECORD FOUND</span><span className={styles.cardDot}/><span>KEEP LOOKING</span></div>
      </div>
      <div className={styles.copy}>
        <span className="eyebrow">Archive note 404</span>
        <h1 id="not-found-title" className="serif">That page slipped between the shelves.</h1>
        <p>We looked through the stacks, the drafts, and the quiet corners. There is no page here—at least not yet.</p>
        <div className={styles.actions}>
          <Link href="/library" className="pill primary">Return to the library</Link>
          <Link href="/" className="pill">Go home</Link>
        </div>
      </div>
    </div>
    <p className={styles.colophon} aria-hidden="true">Some stories take the scenic route.</p>
  </main>;
}
