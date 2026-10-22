"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode, type RefObject } from "react";
import type { ReaderContent } from "@/lib/chapter-content";
import { RichDocumentRenderer } from "@/components/rich-document-renderer";
import { ReaderMedia } from "@/components/reader-media";
import { defaultReaderPreferences, isSecureMediaUrl, normalizeReaderPreferences, type ReaderPreferences } from "@/lib/reader-state";
import { saveReadingProgress, toggleBookmark } from "@/app/actions";
import styles from "./reader-experience.module.css";
import { ArrowLeft, ArrowRight, Bookmark, List, Settings2, Share2, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ChapterLink = { id: string; title: string; position: number };
type Preferences = ReaderPreferences;
const defaults = defaultReaderPreferences;
const COMPLETION_THRESHOLD = 0.95;
const PdfReader = dynamic(() => import("@/components/pdf-reader").then((module) => module.PdfReader), {
  loading: () => <p className="pdf-reader-state" role="status">Preparing the PDF reader…</p>,
});

function Media({ url, alt }: { url: string; alt: string }) {
  if (!isSecureMediaUrl(url)) return null;
  return <ReaderMedia url={url} alt={alt || "Story illustration"}/>;
}

function Chat({ messages }: { messages: Array<{ speaker: string; text: string }> }) {
  return <div className="chat-transcript">{messages.map((message, index) => <div className="chat-line" key={`${index}-${message.speaker}`}><span className="chat-speaker">{message.speaker}</span><p>{message.text}</p></div>)}</div>;
}

function Content({ content, chapterTitle }: { content: ReaderContent; chapterTitle: string }) {
  if (content.type === "rich") return <div className="prose-content rich-reader"><RichDocumentRenderer document={content.document}/></div>;
  if (content.type === "prose") return <div className="prose-content">{content.text.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>;
  if (content.type === "image") return <Media url={content.url} alt={content.alt}/>;
  if (content.type === "comic") return <div className="comic-panels">{content.panels.map((panel, index) => <Media key={`${panel.url}-${index}`} url={panel.url} alt={panel.alt}/>)}</div>;
  if (content.type === "chat") return <Chat messages={content.messages}/>;
  if (content.type === "pdf") return <PdfReader url={content.url} title={chapterTitle}/>;
  return <div className="mixed-content">{content.blocks.map((block, index) => <section key={`${block.type}-${index}`}>{block.type === "prose" ? <Content content={block} chapterTitle={chapterTitle}/> : block.type === "image" ? <Media url={block.url} alt={block.alt}/> : <Chat messages={block.messages}/>}</section>)}</div>;
}

export function BookmarkButton({ workId, initialSaved, iconOnly = false }: { workId: string; initialSaved: boolean; iconOnly?: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const toggle = () => startTransition(async () => {
    setMessage("");
    try {
      const result = await toggleBookmark(workId, !saved);
      if (result.ok) setSaved(result.saved);
      else setMessage(result.message);
    } catch { setMessage("We couldn’t update your bookmark. Please try again."); }
  });
  return <div className="reader-action-wrap"><button type="button" className="pill" aria-label={saved ? "Remove bookmark" : "Bookmark story"} title={saved ? "Remove bookmark" : "Bookmark story"} aria-pressed={saved} disabled={pending} onClick={toggle}>{iconOnly ? <Bookmark size={18} fill={saved ? "currentColor" : "none"} aria-hidden="true"/> : pending ? "Saving…" : saved ? "Bookmarked" : "Bookmark story"}</button>{message && <span role="alert" className="reader-action-message">{message}</span>}</div>;
}

export function ShareButton({ title, iconOnly = false }: { title?: string; iconOnly?: boolean }) {
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage("Link copied.");
      setOpen(false);
    } catch (error) {
      setMessage("We couldn’t copy the link. Copy it from your browser address bar.");
    }
  };
  const share = async () => {
    if (!navigator.share) { setMessage("Device sharing is not available here. Copy the link instead."); return; }
    try { await navigator.share({ title: title || document.title, url: window.location.href }); setOpen(false); }
    catch (error) { if (!(error instanceof Error && error.name === "AbortError")) setMessage("We couldn’t open the share sheet."); }
  };
  return <div className="reader-action-wrap"><button type="button" className="pill" onClick={() => { setMessage(""); setOpen(true); }} aria-label="Share story" title="Share story">{iconOnly ? <Share2 size={18} aria-hidden="true"/> : "Share link"}</button>{message && <span role="status" className="reader-action-message">{message}</span>}<Dialog open={open} onOpenChange={setOpen}><DialogContent className="reader-share-dialog"><DialogHeader><DialogTitle>Share this chapter</DialogTitle><DialogDescription>Copy a link or open your device share options.</DialogDescription></DialogHeader><div className="reader-share-actions"><button type="button" className="pill primary" onClick={() => void copy()}>Copy link</button><button type="button" className="pill" onClick={() => void share()}>Share…</button></div><DialogClose asChild><button type="button" className="text-action">Close</button></DialogClose></DialogContent></Dialog></div>;
}

export function ResumeLink({ workId, firstChapterId, savedChapterId, chapterIds = [], allowGuestLocal = true }: { workId: string; firstChapterId?: string; savedChapterId?: string; chapterIds?: string[]; allowGuestLocal?: boolean }) {
  const [href, setHref] = useState(savedChapterId ? `/work/${workId}/chapter/${savedChapterId}` : firstChapterId ? `/work/${workId}/chapter/${firstChapterId}` : `/work/${workId}`);
  const [label, setLabel] = useState(savedChapterId ? "Resume reading" : "Start reading");
  useEffect(() => {
    if (!allowGuestLocal) return;
    try {
      const saved = localStorage.getItem(`smarties-reading:${workId}`);
      if (!saved) return;
      const state = JSON.parse(saved) as { chapterId?: string };
      if (state.chapterId && chapterIds.includes(state.chapterId)) { setHref(`/work/${workId}/chapter/${state.chapterId}`); setLabel("Resume reading"); }
    } catch { /* Ignore malformed local reader history. */ }
  }, [allowGuestLocal, chapterIds, workId]);
  return <Link href={href} className="pill primary">{label}</Link>;
}

export function ReaderExperience({ workId, chapterId, workTitle, author, chapterTitle, content, chapters, authenticated, previewingDraft = false, initialSaved = false, savedProgress = 0, children }: { workId: string; chapterId: string; workTitle?: string; author?: { displayName: string; username?: string }; chapterTitle: string; content: ReaderContent; chapters: ChapterLink[]; authenticated: boolean; previewingDraft?: boolean; initialSaved?: boolean; savedProgress?: number; children?: ReactNode }) {
  const router = useRouter();
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsShortcutVisible, setSettingsShortcutVisible] = useState(false);
  const [progress, setProgress] = useState(savedProgress);
  const progressRef = useRef(savedProgress);
  const [saveMessage, setSaveMessage] = useState("");
  const articleRef = useRef<HTMLElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsShortcutRef = useRef<HTMLButtonElement>(null);
  const settingsFocusReturnRef = useRef(settingsButtonRef);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocalSave = useRef(0);
  const restoringProgress = useRef(false);
  const restoredChapter = useRef<string | null>(null);
  const current = chapters.findIndex((chapter) => chapter.id === chapterId);
  const previous = current > 0 ? chapters[current - 1] : undefined;
  const next = current >= 0 ? chapters[current + 1] : undefined;
  const completed = !previewingDraft && progress >= COMPLETION_THRESHOLD;

  useEffect(() => {
    if (previewingDraft) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, button, [role=dialog]"))) return;
      if (event.key === "ArrowLeft" && previous) { event.preventDefault(); router.push(`/work/${workId}/chapter/${previous.id}`); }
      if (event.key === "ArrowRight" && next) { event.preventDefault(); router.push(`/work/${workId}/chapter/${next.id}`); }
      if (event.key.toLowerCase() === "s") { event.preventDefault(); settingsButtonRef.current?.click(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, previous, previewingDraft, router, workId]);

  useEffect(() => {
    try {
      if (authenticated) localStorage.removeItem(`smarties-reading:${workId}`);
      const stored = localStorage.getItem("smarties-reader-preferences");
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Preferences>;
        setPreferences(normalizeReaderPreferences(parsed));
      }
      if (!authenticated && !previewingDraft) {
        const local = localStorage.getItem(`smarties-reading:${workId}`);
        if (local) {
          const parsed = JSON.parse(local) as { chapterId?: string; progress?: number };
          if (parsed.chapterId === chapterId && typeof parsed.progress === "number") {
            progressRef.current = parsed.progress;
            setProgress(parsed.progress);
          }
        }
      }
    } catch { /* Use defaults if browser storage is unavailable. */ }
    setPreferencesReady(true);
  }, [authenticated, chapterId, previewingDraft, workId]);

  useEffect(() => {
    if (previewingDraft || !preferencesReady || restoredChapter.current === chapterId) return;
    const frame = window.requestAnimationFrame(() => {
      const article = articleRef.current;
      if (!article) return;
      restoredChapter.current = chapterId;
      const savedPosition = progressRef.current;
      if (savedPosition <= 0) return;
      restoringProgress.current = true;
      const top = article.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + Math.max(article.offsetHeight - window.innerHeight, 1) * Math.min(savedPosition, 0.98), behavior: "instant" });
      window.setTimeout(() => { restoringProgress.current = false; }, 150);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chapterId, preferencesReady, previewingDraft]);

  useEffect(() => {
    if (preferencesReady) {
      try { localStorage.setItem("smarties-reader-preferences", JSON.stringify(preferences)); } catch { /* Reader settings remain available for this visit. */ }
    }
  }, [preferences, preferencesReady]);

  useEffect(() => {
    setTocOpen(false);
  }, [chapterId]);

  const persistProgress = useCallback((value: number) => {
    if (previewingDraft) return;
    setProgress(value);
    progressRef.current = value;
    if (Date.now() - lastLocalSave.current > 800) {
      lastLocalSave.current = Date.now();
      if (!authenticated) try { localStorage.setItem(`smarties-reading:${workId}`, JSON.stringify({ chapterId, progress: value, savedAt: Date.now() })); } catch { /* Guest progress is best effort. */ }
    }
    if (authenticated) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const ok = await saveReadingProgress(workId, chapterId, value).catch(() => false);
        setSaveMessage(ok ? "Progress saved" : "Progress could not be saved");
      }, 1200);
    }
  }, [authenticated, chapterId, previewingDraft, workId]);

  const flushProgress = useCallback((value = progressRef.current) => {
    if (previewingDraft || !authenticated || !Number.isFinite(value)) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const payload = JSON.stringify({ workId, chapterId, progress: Math.max(0, Math.min(1, value)) });
    const body = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/reader/progress", body)) return;
    void fetch("/api/reader/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => undefined);
  }, [authenticated, chapterId, previewingDraft, workId]);

  useEffect(() => {
    if (previewingDraft) return;
    const saveLatest = () => {
      if (!authenticated) try { localStorage.setItem(`smarties-reading:${workId}`, JSON.stringify({ chapterId, progress: progressRef.current, savedAt: Date.now() })); } catch { /* Guest progress is best effort. */ }
      flushProgress();
    };
    const saveWhenHidden = () => { if (document.visibilityState === "hidden") saveLatest(); };
    window.addEventListener("pagehide", saveLatest);
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => {
      window.removeEventListener("pagehide", saveLatest);
      document.removeEventListener("visibilitychange", saveWhenHidden);
      saveLatest();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [chapterId, flushProgress, previewingDraft, workId]);

  const onScroll = useCallback(() => {
    if (restoringProgress.current) return;
    const article = articleRef.current;
    if (!article) return;
    const top = article.getBoundingClientRect().top + window.scrollY;
    const height = Math.max(article.offsetHeight - window.innerHeight, 1);
    const atDocumentEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 24;
    persistProgress(atDocumentEnd ? 1 : Math.max(0, Math.min(1, (window.scrollY - top) / height)));
  }, [persistProgress]);

  useEffect(() => {
    if (previewingDraft) return;
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll, previewingDraft]);

  useEffect(() => {
    const updateShortcut = () => {
      const article = articleRef.current;
      if (!article) return;
      const bounds = article.getBoundingClientRect();
      const pager = document.querySelector(".chapter-pager");
      const pagerBounds = pager?.getBoundingClientRect();
      const pagerVisible = !!pagerBounds && pagerBounds.top < window.innerHeight && pagerBounds.bottom > 0;
      setSettingsShortcutVisible(bounds.top <= 140 && bounds.bottom > 0 && !pagerVisible);
    };
    updateShortcut();
    window.addEventListener("scroll", updateShortcut, { passive: true });
    window.addEventListener("resize", updateShortcut);
    return () => {
      window.removeEventListener("scroll", updateShortcut);
      window.removeEventListener("resize", updateShortcut);
    };
  }, []);

  const openSettings = (button: RefObject<HTMLButtonElement | null>) => {
    settingsFocusReturnRef.current = button;
    setSettingsOpen(true);
  };

  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPreferences((previousValue) => ({ ...previousValue, [key]: value }));
  const progressPercent = Math.round(progress * 100);
  const storyTitle = workTitle || "Story";
  const authorLabel = author?.displayName || "Archive member";

  return <><main id="main-content" tabIndex={-1} className={`reader-page ${styles.readerPage}`} data-theme={preferences.theme}>
    <nav className={`reader-topbar ${styles.readerTopbar}`} aria-label="Reader navigation">
      <div className={styles.readerContext} aria-label="Current story">
        <span className={styles.readerContextTitle}>{storyTitle}</span>
        {author?.username ? <Link href={`/author/${author.username}`} className={styles.readerContextAuthor}>By {authorLabel}</Link> : <span className={styles.readerContextAuthor}>By {authorLabel}</span>}
      </div>
      <div className={styles.readerActionBar} aria-label="Reader actions">
        <Link href={`/work/${workId}`} className={`${styles.readerAction} ${styles.readerBack}`} aria-label={`Open story details for ${storyTitle}`} title="Story details"><ArrowLeft size={18} aria-hidden="true"/></Link>
        <button type="button" className={`${styles.readerAction} ${styles.tocButton}`} aria-label="Open chapter contents" title="Chapters" aria-expanded={tocOpen} aria-controls="table-of-contents" onClick={() => setTocOpen((open) => !open)}><List size={18} aria-hidden="true"/><span className={styles.tocCount}>{current >= 0 ? current + 1 : "—"}/{chapters.length}</span></button>
        {!previewingDraft && (authenticated ? <BookmarkButton workId={workId} initialSaved={initialSaved} iconOnly/> : <Link href={`/auth?mode=login&next=${encodeURIComponent(`/work/${workId}/chapter/${chapterId}`)}`} className={styles.readerAction} aria-label="Sign in to bookmark" title="Sign in to bookmark"><Bookmark size={18} aria-hidden="true"/></Link>)}
        {!previewingDraft && <ShareButton title={`${storyTitle} — ${chapterTitle}`} iconOnly/>}
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <button ref={settingsButtonRef} type="button" className={styles.readerAction} aria-label="Reading settings" title="Reading settings" aria-haspopup="dialog" onClick={() => openSettings(settingsButtonRef)}><Settings2 size={18} aria-hidden="true"/></button>
          <DialogContent id="reader-preferences" className={`${styles.preferencesDialog} reader-tools`} data-theme={preferences.theme} showCloseButton={false} onCloseAutoFocus={(event) => { event.preventDefault(); (settingsFocusReturnRef.current.current ?? settingsButtonRef.current)?.focus({ preventScroll: true }); }}>
            <DialogHeader className={styles.preferenceHeader}><div><DialogTitle>Reading preferences</DialogTitle><DialogDescription>Your choices are saved on this device.</DialogDescription></div><div className={styles.preferenceActions}><button type="button" className={styles.resetButton} onClick={() => setPreferences(defaults)}>Reset</button><DialogClose asChild><button type="button" className={styles.resetButton} aria-label="Close reading settings" title="Close settings"><X size={17} aria-hidden="true"/></button></DialogClose></div></DialogHeader>
            <div className={styles.preferenceGrid}>
              <fieldset className={styles.preferenceGroup}><legend>Typography</legend>
                <label htmlFor="reader-font">Typeface<select id="reader-font" value={preferences.font} onChange={(event) => update("font", event.target.value as Preferences["font"])}><option value="serif">Literary serif</option><option value="sans">Sans serif</option></select></label>
                <label htmlFor="reader-size">Text size<span className={styles.preferenceValue}>{preferences.size}px</span><input id="reader-size" type="range" min="16" max="28" step="1" value={preferences.size} onChange={(event) => update("size", Number(event.target.value))}/></label>
                <label htmlFor="reader-leading">Line spacing<span className={styles.preferenceValue}>{preferences.leading.toFixed(1)}×</span><input id="reader-leading" type="range" min="1.4" max="2.2" step="0.1" value={preferences.leading} onChange={(event) => update("leading", Number(event.target.value))}/></label>
                <label htmlFor="reader-spacing">Paragraph spacing<span className={styles.preferenceValue}>{preferences.spacing.toFixed(1)}×</span><input id="reader-spacing" type="range" min="0.5" max="2.5" step="0.1" value={preferences.spacing} onChange={(event) => update("spacing", Number(event.target.value))}/></label>
              </fieldset>
              <fieldset className={styles.preferenceGroup}><legend>Layout</legend>
                <label htmlFor="reader-width">Reading width<select id="reader-width" value={preferences.width} onChange={(event) => update("width", Number(event.target.value))}><option value="620">Narrow</option><option value="760">Comfortable</option><option value="900">Wide</option></select></label>
                <p className={styles.preferenceHint}>Choose a wider column for images or a narrower one for prose.</p>
              </fieldset>
              <fieldset className={`${styles.preferenceGroup} ${styles.themeGroup}`}><legend>Page tone</legend><div className={styles.themeChoices}>{(["dark", "light", "sepia"] as const).map((theme) => <button type="button" key={theme} className={`theme-swatch ${styles.themeButton}`} data-selected={preferences.theme === theme} aria-label={`${theme} page theme`} aria-pressed={preferences.theme === theme} onClick={() => update("theme", theme)}>{theme}</button>)}</div></fieldset>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <span className={`reader-save-status ${styles.readerSaveStatus}`} aria-live="polite" aria-atomic="true">{saveMessage}</span>
    </nav>
    {!previewingDraft && <div className={`reader-progress ${styles.readerProgress}`} role="progressbar" aria-label="Chapter reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} aria-valuetext={`${progressPercent}% read`}><span style={{ width: `${progressPercent}%` }}/></div>}
    {settingsShortcutVisible && <button ref={settingsShortcutRef} type="button" className={styles.settingsShortcut} aria-label="Reading settings" aria-haspopup="dialog" onClick={() => openSettings(settingsShortcutRef)}><Settings2 size={18} aria-hidden="true"/><span>Reading settings</span></button>}
    <div className={`reader-layout ${styles.readerLayout}`}>
      <aside id="table-of-contents" className={`reader-toc ${styles.readerToc}`} data-open={tocOpen}>
        <div className={styles.tocHeader}><span className="eyebrow">Contents</span><button type="button" className={styles.tocClose} onClick={() => setTocOpen(false)} aria-label="Close table of contents">Close</button></div>
        <ol aria-label="Chapters">{chapters.map((chapter) => <li key={chapter.id}><Link href={`/work/${workId}/chapter/${chapter.id}`} aria-current={chapter.id === chapterId ? "page" : undefined} onClick={() => { setTocOpen(false); flushProgress(); }}>{chapter.title}</Link></li>)}</ol>
      </aside>
      <div className="reader-main">{previewingDraft && <p className="reader-draft-notice" role="status">Saved draft preview · Only you can see these changes. <Link href={`/studio/${workId}?chapter=${chapterId}`}>Return to editor</Link></p>}<header className="reader-chapter-heading" style={{ maxWidth: `${preferences.width}px` }}><span className="eyebrow">Chapter {current >= 0 ? current + 1 : "—"} of {chapters.length}</span><h1 className="serif">{chapterTitle}</h1></header>
        <article ref={articleRef} className={`reader-article reader-font-${preferences.font} ${styles.readerArticle}`} aria-label={`${chapterTitle} content`} style={{ "--reader-size": `${preferences.size}px`, "--reader-leading": preferences.leading, "--reader-spacing": `${preferences.spacing}em`, maxWidth: `${preferences.width}px` } as React.CSSProperties}><Content content={content} chapterTitle={chapterTitle}/></article>
        {completed && <section className={styles.completionCard} aria-live="polite" aria-label="Chapter completion">
          <span className="eyebrow">Chapter complete</span>
          <h2 className="serif">{next ? "Ready for the next chapter?" : "You reached the end."}</h2>
          <p>{next ? `Continue with ${next.title}.` : "You have finished the published chapters in this story."}</p>
          {next ? <Link href={`/work/${workId}/chapter/${next.id}`} className="pill primary" rel="next" onClick={() => flushProgress(1)}>Continue reading</Link> : <Link href={`/work/${workId}`} className="pill primary" onClick={() => flushProgress(1)}>Back to story details</Link>}
        </section>}
        {(previous || !completed) && <nav className={`chapter-pager ${styles.chapterPager}`} aria-label="Chapter navigation">{previous ? <Link href={`/work/${workId}/chapter/${previous.id}`} rel="prev" aria-label={`Previous chapter: ${previous.title}`} onClick={() => flushProgress()}><ArrowLeft size={16} aria-hidden="true"/> Previous<span>{previous.title}</span></Link> : <span/>}{!completed && (next ? <Link href={`/work/${workId}/chapter/${next.id}`} rel="next" aria-label={`Next chapter: ${next.title}`} onClick={() => flushProgress()}>Next <ArrowRight size={16} aria-hidden="true"/><span>{next.title}</span></Link> : <Link href={`/work/${workId}`} aria-label="Return to story details" onClick={() => flushProgress()}>Story details</Link>)}</nav>}
      </div>
    </div>
  </main><div className="reader-secondary" data-theme={preferences.theme}>{children}</div></>;
}
