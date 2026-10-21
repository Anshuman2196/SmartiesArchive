"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./reader-media.module.css";

const MIN_SCALE = 1;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

export function ReaderMedia({ url, alt }: { url: string; alt: string }) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(MIN_SCALE);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  useEffect(() => {
    setCanFullscreen(typeof document !== "undefined" && "requestFullscreen" in document.documentElement);
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === dialogRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  if (!url) return null;
  const label = alt || "Story illustration";
  const close = () => {
    if (document.fullscreenElement === dialogRef.current) void document.exitFullscreen();
    setOpen(false);
  };
  const changeScale = (amount: number) => setScale((value) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number((value + amount).toFixed(2)))));
  const toggleFullscreen = () => {
    if (!dialogRef.current?.requestFullscreen) return;
    if (document.fullscreenElement === dialogRef.current) void document.exitFullscreen();
    else void dialogRef.current.requestFullscreen();
  };

  return <>
    <figure className={`reader-media ${styles.mediaFigure}`}>
      <button ref={triggerRef} type="button" className={styles.mediaButton} onClick={() => { setScale(MIN_SCALE); setOpen(true); }} aria-label={`Open ${label} in the image viewer`}>
        <Image src={url} alt={label} width={1440} height={1000} unoptimized sizes="(max-width: 760px) 100vw, 900px"/>
        <span className={styles.zoomHint} aria-hidden="true">Open image viewer</span>
      </button>
      <figcaption>{label}</figcaption>
    </figure>
    {open && <div className={styles.dialogBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-label={`${label} image viewer`} tabIndex={-1}>
        <div className={styles.dialogHeader}>
          <p>{label}</p>
          <button type="button" className={styles.dialogButton} onClick={close} aria-label="Close image viewer">Close</button>
        </div>
        <div className={styles.viewport}>
          <Image className={styles.zoomedImage} src={url} alt={label} width={1440} height={1000} unoptimized sizes="100vw" style={{ transform: `scale(${scale})` }}/>
        </div>
        <div className={styles.dialogControls} aria-label="Image viewer controls">
          <button type="button" className={styles.dialogButton} onClick={() => changeScale(-SCALE_STEP)} disabled={scale <= MIN_SCALE} aria-label="Zoom out">−</button>
          <span aria-live="polite">{Math.round(scale * 100)}%</span>
          <button type="button" className={styles.dialogButton} onClick={() => changeScale(SCALE_STEP)} disabled={scale >= MAX_SCALE} aria-label="Zoom in">+</button>
          <button type="button" className={styles.dialogButton} onClick={() => setScale(MIN_SCALE)} disabled={scale === MIN_SCALE}>Reset zoom</button>
          <button type="button" className={styles.dialogButton} onClick={toggleFullscreen} disabled={!canFullscreen}>{fullscreen ? "Exit fullscreen" : "Fullscreen"}</button>
        </div>
      </div>
    </div>}
  </>;
}
