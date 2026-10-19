"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { ReaderContent } from "@/lib/chapter-content";
import { defaultReaderPreferences, isSecureMediaUrl, normalizeReaderPreferences, type ReaderPreferences } from "@/lib/reader-state";
import { saveReadingProgress, toggleBookmark } from "@/app/actions";

type ChapterLink = { id: string; title: string; position: number };
type Preferences = ReaderPreferences;
const defaults = defaultReaderPreferences;

function Media({ url, alt }: { url: string; alt: string }) {
  if (!isSecureMediaUrl(url)) return null;
  return <figure className="reader-media"><Image src={url} alt={alt || "Story illustration"} width={1440} height={1000} unoptimized sizes="(max-width: 760px) 100vw, 900px"/><figcaption>{alt || "Story illustration"}</figcaption></figure>;
}

function Chat({ messages }: { messages: Array<{ speaker: string; text: string }> }) {
  return <div className="chat-transcript">{messages.map((message, index) => <div className="chat-line" key={`${index}-${message.speaker}`}><span className="chat-speaker">{message.speaker}</span><p>{message.text}</p></div>)}</div>;
}

function Content({ content }: { content: ReaderContent }) {
  if (content.type === "prose") return <div className="prose-content">{content.text.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>;
  if (content.type === "image") return <Media url={content.url} alt={content.alt}/>;
  if (content.type === "comic") return <div className="comic-panels">{content.panels.map((panel, index) => <Media key={`${panel.url}-${index}`} url={panel.url} alt={panel.alt}/>)}</div>;
  if (content.type === "chat") return <Chat messages={content.messages}/>;
  return <div className="mixed-content">{content.blocks.map((block, index) => <section key={`${block.type}-${index}`}>{block.type === "prose" ? <Content content={block}/> : block.type === "image" ? <Media url={block.url} alt={block.alt}/> : <Chat messages={block.messages}/>}</section>)}</div>;
}

export function BookmarkButton({ workId, initialSaved }: { workId: string; initialSaved: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const toggle = () => startTransition(async () => {
    setMessage("");
    try {
      const result = await toggleBookmark(workId, !saved);
      if (result.ok) setSaved(result.saved);
      else setMessage(result.message);
    } catch { setMessage("We couldn't update your bookmark. Please try again."); }
  });
  return <div className="reader-action-wrap"><button type="button" className="pill" aria-pressed={saved} disabled={pending} onClick={toggle}>{pending ? "Saving…" : saved ? "Bookmarked" : "Bookmark story"}</button>{message && <span role="alert" className="reader-action-message">{message}</span>}</div>;
}

export function ShareButton() {
  const [message, setMessage] = useState("");
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: document.title, url });
      else { await navigator.clipboard.writeText(url); setMessage("Link copied."); }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setMessage("We couldn't share that link. Copy it from your browser address bar.");
    }
  };
  return <div className="reader-action-wrap"><button type="button" className="pill" onClick={share}>Share link</button>{message && <span role="status" className="reader-action-message">{message}</span>}</div>;
}

export function ResumeLink({ workId, firstChapterId, savedChapterId, chapterIds = [] }: { workId: string; firstChapterId?: string; savedChapterId?: string; chapterIds?: string[] }) {
  const [href, setHref] = useState(savedChapterId ? `/work/${workId}/chapter/${savedChapterId}` : firstChapterId ? `/work/${workId}/chapter/${firstChapterId}` : `/work/${workId}`);
  const [label, setLabel] = useState(savedChapterId ? "Resume reading" : "Start reading");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`smarties-reading:${workId}`);
      if (!saved) return;
      const state = JSON.parse(saved) as { chapterId?: string };
      if (state.chapterId && chapterIds.includes(state.chapterId)) { setHref(`/work/${workId}/chapter/${state.chapterId}`); setLabel("Resume reading"); }
    } catch { /* Ignore malformed local reader history. */ }
  }, [chapterIds, workId]);
  return <Link href={href} className="pill primary">{label}</Link>;
}

export function ReaderExperience({ workId, chapterId, chapterTitle, content, chapters, authenticated, savedProgress = 0 }: { workId: string; chapterId: string; chapterTitle: string; content: ReaderContent; chapters: ChapterLink[]; authenticated: boolean; savedProgress?: number }) {
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [progress, setProgress] = useState(savedProgress);
  const progressRef = useRef(savedProgress);
  const [saveMessage, setSaveMessage] = useState("");
  const articleRef = useRef<HTMLElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocalSave = useRef(0);
  const restoringProgress = useRef(false);
  const current = chapters.findIndex((chapter) => chapter.id === chapterId);
  const previous = current > 0 ? chapters[current - 1] : undefined;
  const next = current >= 0 ? chapters[current + 1] : undefined;

  useEffect(() => {
    try {
      const stored = localStorage.getItem("smarties-reader-preferences");
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Preferences>;
        setPreferences(normalizeReaderPreferences(parsed));
      }
      if (!authenticated) {
        const local = localStorage.getItem(`smarties-reading:${workId}`);
        if (local) {
          const parsed = JSON.parse(local) as { chapterId?: string; progress?: number };
          if (parsed.chapterId === chapterId && typeof parsed.progress === "number") setProgress(parsed.progress);
        }
      }
    } catch { /* Use defaults if browser storage is unavailable. */ }
    setPreferencesReady(true);
  }, [authenticated, chapterId, workId]);

  useEffect(() => {
    if (!preferencesReady || progress <= 0) return;
    restoringProgress.current = true;
    const frame = window.requestAnimationFrame(() => {
      const article = articleRef.current;
      if (!article) { restoringProgress.current = false; return; }
      const top = article.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + Math.max(article.offsetHeight - window.innerHeight, 1) * Math.min(progress, 0.98), behavior: "instant" });
      window.setTimeout(() => { restoringProgress.current = false; }, 150);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [preferencesReady, progress]);

  useEffect(() => {
    if (preferencesReady) {
      try { localStorage.setItem("smarties-reader-preferences", JSON.stringify(preferences)); } catch { /* Reader settings remain available for this visit. */ }
    }
  }, [preferences, preferencesReady]);

  const persistProgress = useCallback((value: number) => {
    setProgress(value);
    progressRef.current = value;
    if (Date.now() - lastLocalSave.current > 800) {
      lastLocalSave.current = Date.now();
      try { localStorage.setItem(`smarties-reading:${workId}`, JSON.stringify({ chapterId, progress: value })); } catch { /* Guest progress is best effort. */ }
    }
    if (authenticated) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const ok = await saveReadingProgress(workId, chapterId, value).catch(() => false);
        setSaveMessage(ok ? "Progress saved" : "Progress could not be saved");
      }, 1200);
    }
  }, [authenticated, chapterId, workId]);

  useEffect(() => {
    const saveLatest = () => { try { localStorage.setItem(`smarties-reading:${workId}`, JSON.stringify({ chapterId, progress: progressRef.current })); } catch { /* Progress storage is optional. */ } };
    window.addEventListener("pagehide", saveLatest);
    return () => { window.removeEventListener("pagehide", saveLatest); if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [chapterId, workId]);

  const onScroll = useCallback(() => {
    if (restoringProgress.current) return;
    const article = articleRef.current;
    if (!article) return;
    const top = article.getBoundingClientRect().top + window.scrollY;
    const height = Math.max(article.offsetHeight - window.innerHeight, 1);
    persistProgress(Math.max(0, Math.min(1, (window.scrollY - top) / height)));
  }, [persistProgress]);

  useEffect(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPreferences((previousValue) => ({ ...previousValue, [key]: value }));

  return <main className="reader-page" data-theme={preferences.theme}>
    <div className="reader-topbar"><Link href={`/work/${workId}`} className="reader-back">← Story details</Link><a href="#table-of-contents" className="reader-toc-jump">Contents</a><span className="reader-save-status" aria-live="polite">{saveMessage}</span></div>
    <div className="reader-layout">
      <aside id="table-of-contents" className="reader-toc"><span className="eyebrow">Contents</span><ol>{chapters.map((chapter) => <li key={chapter.id}><Link href={`/work/${workId}/chapter/${chapter.id}`} aria-current={chapter.id === chapterId ? "page" : undefined}>{chapter.title}</Link></li>)}</ol></aside>
      <div className="reader-main"><header className="reader-chapter-heading"><span className="eyebrow">Chapter {current >= 0 ? current + 1 : "—"} of {chapters.length}</span><h1 className="serif">{chapterTitle}</h1><div className="reader-progress" role="progressbar" aria-label="Chapter reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><span style={{ width: `${Math.round(progress * 100)}%` }}/></div></header>
        <div className="reader-tools" aria-label="Reading preferences"><label>Typeface<select value={preferences.font} onChange={(event) => update("font", event.target.value as Preferences["font"])}><option value="serif">Literary serif</option><option value="sans">Sans serif</option></select></label><label>Text size<input aria-label="Text size" type="range" min="16" max="28" step="1" value={preferences.size} onChange={(event) => update("size", Number(event.target.value))}/></label><label>Line spacing<input aria-label="Line spacing" type="range" min="1.4" max="2.2" step="0.1" value={preferences.leading} onChange={(event) => update("leading", Number(event.target.value))}/></label><label>Paragraph spacing<input aria-label="Paragraph spacing" type="range" min="0.5" max="2.5" step="0.1" value={preferences.spacing} onChange={(event) => update("spacing", Number(event.target.value))}/></label><label>Reading width<select value={preferences.width} onChange={(event) => update("width", Number(event.target.value))}><option value="620">Narrow</option><option value="760">Comfortable</option><option value="900">Wide</option></select></label><fieldset><legend>Page tone</legend>{(["dark", "light", "sepia"] as const).map((theme) => <button type="button" key={theme} className="theme-swatch" data-selected={preferences.theme === theme} aria-label={`${theme} page theme`} aria-pressed={preferences.theme === theme} onClick={() => update("theme", theme)}>{theme}</button>)}</fieldset></div>
        <article ref={articleRef} className={`reader-article reader-font-${preferences.font}`} style={{ "--reader-size": `${preferences.size}px`, "--reader-leading": preferences.leading, "--reader-spacing": `${preferences.spacing}em`, maxWidth: `${preferences.width}px` } as React.CSSProperties}><Content content={content}/></article>
        <nav className="chapter-pager" aria-label="Chapter navigation">{previous ? <Link href={`/work/${workId}/chapter/${previous.id}`} rel="prev">← Previous<span>{previous.title}</span></Link> : <span/>}{next ? <Link href={`/work/${workId}/chapter/${next.id}`} rel="next">Next →<span>{next.title}</span></Link> : <Link href={`/work/${workId}`}>Story details →</Link>}</nav>
      </div>
    </div>
  </main>;
}
