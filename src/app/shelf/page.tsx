import Image from "next/image";
import Link from "next/link";
import { getShelf, type ShelfItem } from "@/lib/shelf";
import styles from "./page.module.css";
import { CoverFallback } from "@/components/cover-fallback";

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function ShelfCard({ item, section }: { item: ShelfItem; section: "bookmark" | "reading" | "finished" }) {
  const progressPercent = item.progress === null ? null : Math.min(100, Math.round(item.progress * 100));
  const actionLabel = section === "reading" ? "Continue reading" : section === "finished" ? "Read again" : "Open story";
  const date = formatDate(section === "bookmark" ? item.bookmarkCreatedAt : item.progressUpdatedAt);
  const href = section === "reading" && item.chapterId ? `/work/${item.id}/chapter/${item.chapterId}` : `/work/${item.id}`;
  return <Link className={styles.card} href={href} aria-label={`${actionLabel}: ${item.title}`}>
    <div className={styles.poster} aria-hidden="true">
      {item.coverPreviewUrl ? <Image className={styles.posterImage} src={item.coverPreviewUrl} alt="" fill sizes="96px" unoptimized/> : <CoverFallback title={item.title}/>}
    </div>
    <div className={styles.cardBody}>
      <span className={styles.cardType}>{section === "bookmark" ? "Bookmarked" : section === "reading" ? "Currently reading" : "Finished"}</span>
      <h3 className="serif">{item.title}</h3>
      <p className={styles.summary}>{item.summary || "A new story begins here."}</p>
      {item.tags.length > 0 && <div className={styles.tags} aria-label={`Tags for ${item.title}`}>{item.tags.slice(0, 3).map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>}
      {progressPercent !== null && <div className={styles.progressWrap}>
        <div className={styles.progressTrack} role="progressbar" aria-label={`${item.title} reading progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} aria-valuetext={`${progressPercent}% complete`}><span style={{ width: `${progressPercent}%` }}/></div>
        <span className={styles.progressText}>{section === "finished" ? `Finished${item.chapterTitle ? ` · ${item.chapterTitle}` : ""}` : `${progressPercent}%${item.chapterTitle ? ` · ${item.chapterTitle}` : ""}`}</span>
      </div>}
      <span className={styles.cardAction}>{actionLabel}</span>
      <span className={styles.meta}>{item.author?.displayName ?? "A reader"}{date ? ` · ${date}` : ""}</span>
    </div>
  </Link>;
}

function ShelfSection({ id, title, description, items, section, emptyMessage }: { id: string; title: string; description: string; items: ShelfItem[]; section: "bookmark" | "reading" | "finished"; emptyMessage: string }) {
  return <section className={styles.section} aria-labelledby={id}>
    <div className={styles.sectionHeading}><div><span className="eyebrow">{items.length} {items.length === 1 ? "story" : "stories"}</span><h2 id={id} className="serif">{title}</h2><p>{description}</p></div></div>
    {items.length > 0 ? <div className={styles.grid}>{items.map((item) => <ShelfCard key={item.id} item={item} section={section}/>)}</div> : <div className={styles.empty}><p>{emptyMessage}</p><Link className="text-action" href="/library">Browse the library</Link></div>}
  </section>;
}

export default async function ShelfPage() {
  const shelf = await getShelf();

  if (shelf.status === "unauthenticated") return <main className={`shell section ${styles.page}`}><div className={styles.intro}><span className="eyebrow">Your private shelf</span><h1 className="serif">Keep stories close.</h1><p>Sign in to collect bookmarks and pick up where you left off.</p><Link className="pill primary" href="/auth?mode=login&next=%2Fshelf">Sign in to view your shelf</Link></div></main>;
  if (shelf.status === "unavailable") return <main className={`shell section ${styles.page}`}><div className={styles.intro}><span className="eyebrow">Your private shelf</span><h1 className="serif">Your shelf is taking a moment.</h1><p className="notice">We could not load your saved stories right now. Please try again in a moment.</p><Link className="pill" href="/shelf">Try again</Link></div></main>;

  return <main className={`shell section ${styles.page}`}>
    <div className={styles.intro}><div><span className="eyebrow">Your private shelf</span><h1 className="serif">Keep stories close.</h1><p>Bookmarks, unfinished chapters, and the stories you have just finished.</p></div><Link className="pill" href="/library">Find another story</Link></div>
    <ShelfSection id="currently-reading" title="Currently reading" description="Pick up where you left off." items={shelf.currentlyReading} section="reading" emptyMessage="Nothing in progress yet. Start a story and your place will appear here."/>
    <ShelfSection id="bookmarked" title="Bookmarked" description="Stories you want to keep nearby." items={shelf.bookmarked} section="bookmark" emptyMessage="No bookmarks yet. Save a story from its details page to keep it here."/>
    <ShelfSection id="recently-finished" title="Recently finished" description="A small record of stories you made it through." items={shelf.recentlyFinished} section="finished" emptyMessage="Finished stories will appear here when you reach the end of a chapter."/>
  </main>;
}
