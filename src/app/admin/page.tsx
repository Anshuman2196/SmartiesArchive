import type { ReactNode } from "react";
import { adminUnpublishChapter, adminUnpublishWork } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin";
import { workVisibilityLabel, type WorkVisibility } from "@/lib/work-visibility";
import { ConfirmSubmit } from "@/components/confirm-submit";
import styles from "./page.module.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Archive administration", robots: { index: false, follow: false } };

type Count = { count: number };
type Profile = { username: string; display_name: string } | null;
type Work = {
  id: string;
  title: string;
  visibility: WorkVisibility;
  state: "draft" | "published";
  updated_at: string;
  profiles: Profile;
  chapters?: Count[];
};
type Chapter = {
  id: string;
  work_id: string;
  title: string;
  state: "draft" | "published";
  updated_at: string;
  works: { title: string } | null;
};
type Member = {
  id: string;
  username: string;
  display_name: string;
  created_at: string;
  works?: Count[];
};

const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function countFrom(rows?: Count[]) {
  return rows?.[0]?.count ?? 0;
}

function StatusMessage({ status }: { status?: string }) {
  const messages: Record<string, string> = {
    work_unpublished: "The story is now hidden from public shelves.",
    chapter_unpublished: "The chapter is now hidden from readers.",
    unchanged: "Nothing changed. It may already be unpublished.",
    invalid: "That moderation request was invalid.",
  };
  const message = status ? messages[status] : undefined;
  if (!message) return null;
  return <p className={`notice ${styles.status}`} role="status">{message}</p>;
}

function TableSection({ title, count, children, defaultOpen = false }: { title: string; count: number; children: ReactNode; defaultOpen?: boolean }) {
  return <details className={styles.section} open={defaultOpen}><summary><h2>{title}</h2><span>{count} {count === 1 ? "record" : "records"}</span></summary>{children}</details>;
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const { supabase } = await requireAdmin();
  const [
    { count: memberCount },
    { count: storyCount },
    { count: publishedStoryCount },
    { count: chapterCount },
    { data: worksData },
    { data: chaptersData },
    { data: membersData },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("works").select("id", { count: "exact", head: true }),
    supabase.from("works").select("id", { count: "exact", head: true }).eq("state", "published"),
    supabase.from("chapters").select("id", { count: "exact", head: true }),
    supabase.from("works").select("id,title,visibility,state,updated_at,profiles(username,display_name),chapters(count)").order("updated_at", { ascending: false }).limit(100),
    supabase.from("chapters").select("id,work_id,title,state,updated_at,works(title)").order("updated_at", { ascending: false }).limit(100),
    supabase.from("profiles").select("id,username,display_name,created_at,works(count)").order("created_at", { ascending: false }).limit(100),
  ]);

  const works = (worksData ?? []) as unknown as Work[];
  const chapters = (chaptersData ?? []) as unknown as Chapter[];
  const members = (membersData ?? []) as unknown as Member[];

  return <main id="main-content" tabIndex={-1} className={`shell ${styles.page}`}>
    <header className={styles.intro}>
      <div><span className="eyebrow">Private moderation</span><h1>Admin desk</h1><p>A small control room for the archive. Moderation actions only change publication visibility.</p></div>
    </header>
    <StatusMessage status={status}/>

    <section className={styles.stats} aria-label="Archive overview">
      <div className={styles.stat}><span>Members</span><strong>{memberCount ?? 0}</strong></div>
      <div className={styles.stat}><span>Stories</span><strong>{storyCount ?? 0}</strong></div>
      <div className={styles.stat}><span>Published stories</span><strong>{publishedStoryCount ?? 0}</strong></div>
      <div className={styles.stat}><span>Chapters</span><strong>{chapterCount ?? 0}</strong></div>
    </section>

    <TableSection title="Stories" count={works.length} defaultOpen>
      {works.length === 0 ? <div className={styles.empty}>No stories have been created yet.</div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Story</th><th>Author</th><th>Access</th><th>State</th><th>Updated</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{works.map((work) => <tr key={work.id}><td><span className={styles.title}>{work.title}</span><span className={styles.meta}>{countFrom(work.chapters)} {countFrom(work.chapters) === 1 ? "chapter" : "chapters"}</span></td><td>{work.profiles?.display_name ?? "Unknown"}<span className={styles.meta}>@{work.profiles?.username ?? "unknown"}</span></td><td><span className={styles.badge}>{workVisibilityLabel(work.visibility)}</span></td><td><span className={styles.badge}>{work.state === "published" ? "Published" : "Draft"}</span></td><td>{formatDate(work.updated_at)}</td><td>{work.state === "published" && <form action={adminUnpublishWork}><input type="hidden" name="workId" value={work.id}/><ConfirmSubmit className={styles.danger} phrase={`Hide ${work.title} from readers? The author’s content will be kept.`}>Hide story</ConfirmSubmit></form>}</td></tr>)}</tbody></table></div>}
    </TableSection>

    <TableSection title="Chapters" count={chapters.length}>
      {chapters.length === 0 ? <div className={styles.empty}>No chapters have been created yet.</div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Chapter</th><th>Story</th><th>State</th><th>Updated</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{chapters.map((chapter) => <tr key={chapter.id}><td className={styles.title}>{chapter.title}</td><td>{chapter.works?.title ?? "Unknown story"}</td><td><span className={styles.badge}>{chapter.state === "published" ? "Published" : "Draft"}</span></td><td>{formatDate(chapter.updated_at)}</td><td>{chapter.state === "published" && <form action={adminUnpublishChapter}><input type="hidden" name="workId" value={chapter.work_id}/><input type="hidden" name="chapterId" value={chapter.id}/><ConfirmSubmit className={styles.danger} phrase={`Hide ${chapter.title} from readers? The author’s draft will be kept.`}>Hide chapter</ConfirmSubmit></form>}</td></tr>)}</tbody></table></div>}
    </TableSection>

    <TableSection title="Members" count={members.length}>
      {members.length === 0 ? <div className={styles.empty}>No member profiles are available.</div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Member</th><th>Stories</th><th>Joined</th></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td><span className={styles.title}>{member.display_name}</span><span className={styles.meta}>@{member.username}</span></td><td>{countFrom(member.works)}</td><td>{formatDate(member.created_at)}</td></tr>)}</tbody></table></div>}
    </TableSection>
  </main>;
}
