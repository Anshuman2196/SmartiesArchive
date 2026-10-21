import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CoverFallback } from "@/components/cover-fallback";
import { signStoryMediaUrls } from "@/lib/story-media";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

type AuthorWork = { id: string; title: string; summary: string; cover_url: string | null; tags: string[] };

export default async function AuthorPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("id,username,display_name,bio").eq("username", username).maybeSingle();
  if (!profile) notFound();
  const { data } = await supabase.from("works").select("id,title,summary,cover_url,tags").eq("author_id", profile.id).eq("visibility", "public").eq("state", "published").order("created_at", { ascending: false });
  const works = (data ?? []) as AuthorWork[];
  const covers = await signStoryMediaUrls(supabase, works.map((work) => work.cover_url));

  return <main className={`shell section ${styles.page}`}>
    <header className={styles.header}><span className="eyebrow">Writer in the archive</span><h1>{profile.display_name}</h1><p className={styles.handle}>@{profile.username}</p>{profile.bio && <p className={styles.bio}>{profile.bio}</p>}</header>
    <section aria-labelledby="author-stories"><div className={styles.sectionHead}><h2 id="author-stories">Published stories</h2><span>{works.length} {works.length === 1 ? "story" : "stories"}</span></div>
      {works.length ? <div className={styles.list}>{works.map((work) => {
        const cover = work.cover_url ? covers.get(work.cover_url) : null;
        return <Link href={`/work/${work.id}`} className={styles.work} key={work.id} aria-label={`Read ${work.title}`}>
          <div className={styles.poster}>{cover ? <Image src={cover} alt="" fill sizes="(max-width: 540px) 110px, (max-width: 760px) 50vw, 33vw" unoptimized/> : <CoverFallback title={work.title}/>}</div>
          <h3>{work.title}</h3>{work.summary && <p>{work.summary}</p>}{work.tags.length > 0 && <span className={styles.tag}>{work.tags[0]}</span>}
        </Link>;
      })}</div> : <p className={styles.empty}>No public stories here yet.</p>}
    </section>
  </main>;
}
