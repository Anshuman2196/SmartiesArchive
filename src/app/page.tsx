import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signStoryMediaUrls } from "@/lib/story-media";
import { CoverFallback } from "@/components/cover-fallback";

type RecentWork = {
  id: string;
  title: string;
  summary: string;
  cover_url: string | null;
  coverPreviewUrl?: string | null;
  profiles: { display_name: string } | null;
};

const genreArtwork = [
  { tag: "Science Fiction", image: "/images/genre-science-fiction.png" },
  { tag: "Horror", image: "/images/genre-horror.png" },
  { tag: "Dark Fantasy", image: "/images/genre-dark-fantasy.png" },
];

export default async function HomePage() {
  let signedIn = false;
  let recentWorks: RecentWork[] = [];
  let genres: { tag: string; image: string; count: number }[] = [];
  try {
    const supabase = await createClient();
    const [userResult, worksResult, tagsResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("works").select("id,title,summary,cover_url,profiles(display_name)").eq("visibility", "public").eq("state", "published").order("created_at", { ascending: false }).limit(4),
      supabase.from("works").select("tags").eq("visibility", "public").eq("state", "published").limit(100),
    ]);
    signedIn = Boolean(userResult.data.user);
    const works = (worksResult.data ?? []) as unknown as RecentWork[];
    const urls = await signStoryMediaUrls(supabase, works.map((work) => work.cover_url));
    recentWorks = works.map((work) => ({ ...work, coverPreviewUrl: work.cover_url ? urls.get(work.cover_url) ?? null : null }));
    const publishedTags = (tagsResult.data ?? []) as { tags: string[] | null }[];
    genres = genreArtwork.flatMap(({ tag, image }) => {
      const matches = publishedTags.flatMap((work) => work.tags ?? []).filter((value) => value.toLowerCase() === tag.toLowerCase());
      return matches.length ? [{ tag: matches[0], image, count: matches.length }] : [];
    });
  } catch { /* The public entry remains available when the archive is temporarily unavailable. */ }

  const latest = recentWorks[0];
  const more = recentWorks.slice(1);
  const shelfHref = signedIn ? "/shelf" : "/auth?mode=login&next=%2Fshelf";
  const studioHref = signedIn ? "/studio" : "/auth?mode=signup&next=%2Fstudio";

  return <main className="home cinema-home">
    <section className="cinema-hero" aria-labelledby="home-title">
      <div className="shell cinema-hero-inner">
        <div className="cinema-hero-copy">
          <p className="cinema-label">Smarties Archive <span>Original fiction</span></p>
          <h1 id="home-title">The archive<br/>is open.</h1>
          <p>Stories by this community, ready when you are. Read something new, return to your place, or share your own work.</p>
          <div className="cinema-actions"><Link href="/library" className="pill primary">Explore stories</Link><Link href={shelfHref} className="cinema-secondary">Continue reading</Link></div>
        </div>
        {latest && <div className="cinema-feature" aria-label="Latest story">
          <span className="cinema-feature-label">Latest in the archive</span>
          <Link href={`/work/${latest.id}`} className="cinema-feature-link" aria-label={`Open ${latest.title}`}>
            <div className="cinema-feature-poster">{latest.coverPreviewUrl ? <Image src={latest.coverPreviewUrl} alt={`Cover art for ${latest.title}`} fill sizes="(max-width: 760px) 190px, 260px" unoptimized priority/> : <CoverFallback title={latest.title}/>}</div>
            <div className="cinema-feature-meta"><strong>{latest.title}</strong><span>{latest.profiles?.display_name ?? "A reader"}</span></div>
          </Link>
        </div>}
      </div>
    </section>
    {more.length > 0 && <section className="shell cinema-programme" aria-labelledby="programme-title">
      <div className="cinema-section-head"><div><span className="cinema-label">From the archive</span><h2 id="programme-title">More to discover</h2></div><Link href="/library">View the library</Link></div>
      <div className="cinema-programme-grid">{more.map((work, index) => <Link href={`/work/${work.id}`} className="cinema-programme-item" key={work.id}>
        <div className="cinema-programme-poster">{work.coverPreviewUrl ? <Image src={work.coverPreviewUrl} alt="" fill sizes="(max-width: 760px) 110px, 280px" unoptimized/> : <CoverFallback title={work.title}/>}</div>
        <div className="cinema-programme-info"><span>{String(index + 1).padStart(2, "0")}</span><h3>{work.title}</h3><p>{work.profiles?.display_name ?? "A reader"}</p></div>
      </Link>)}</div>
    </section>}
    {genres.length > 0 && <section className="shell cinema-genres" aria-labelledby="genre-title">
      <div className="cinema-section-head"><div><span className="cinema-label">Follow a feeling</span><h2 id="genre-title">Choose a genre.</h2></div></div>
      <div className="cinema-genres-grid">{genres.map((genre) => <Link className="cinema-genre" href={`/library?tag=${encodeURIComponent(genre.tag)}`} key={genre.tag} aria-label={`Browse ${genre.tag} stories`}>
        <Image src={genre.image} alt="" fill sizes="(max-width: 540px) 90vw, (max-width: 760px) 45vw, 33vw"/>
        <span className="cinema-genre-meta"><strong>{genre.tag}</strong><small>{genre.count} {genre.count === 1 ? "story" : "stories"}</small></span>
      </Link>)}</div>
    </section>}
    <section className="shell cinema-community" aria-labelledby="community-title">
      <div className="cinema-community-copy"><span className="cinema-label">The people behind the pages</span><h2 id="community-title">Make something together.</h2><p>Bring your characters, build a world, and share a story with the community.</p><Link href={studioHref} className="pill primary">Open the studio</Link></div>
      <div className="cinema-community-image"><Image src="/images/community-foyer.png" alt="Illustration inspired by member character references: three friends talking in a cinema foyer" fill sizes="(max-width: 760px) 100vw, 55vw"/></div>
    </section>
    <section className="shell cinema-next" aria-label="Continue reading"><div><span className="cinema-label">Pick up where you left off</span><h2>Keep your place.</h2><p>Your shelf holds saved stories and reading progress.</p><Link href={shelfHref}>Open your shelf</Link></div></section>
  </main>;
}
