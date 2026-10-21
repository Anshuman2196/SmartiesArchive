import Image from "next/image";
import styles from "./cover-fallback.module.css";

export function CoverFallback({ title, className = "" }: { title: string; className?: string }) {
  return <div className={`${styles.cover} ${className}`}>
    <Image className={styles.art} src="/images/archive-cover-default.png" alt="" fill sizes="(max-width: 540px) 112px, (max-width: 760px) 220px, 320px"/>
    <div className={styles.copy}><small>Smarties Archive</small><strong>{title}</strong><small>Original fiction</small></div>
  </div>;
}
