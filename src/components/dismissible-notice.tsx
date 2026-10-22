"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./dismissible-notice.module.css";

export function DismissibleNotice({ message, error, hrefWithoutStatus }: { message: string; error?: boolean; hrefWithoutStatus: string }) {
  const [visible, setVisible] = useState(true);
  const router = useRouter();
  if (!visible) return null;
  return <p className={`notice ${error ? "auth-error" : "auth-success"} ${styles.notice}`} role={error ? "alert" : "status"}>
    <span>{message}</span>
    <button type="button" aria-label="Dismiss message" onClick={() => { setVisible(false); router.replace(hrefWithoutStatus, { scroll: false }); }}>Dismiss</button>
  </p>;
}
