"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteChapterReview, saveChapterReview } from "@/app/actions";
import type { ChapterReview, ReviewActionState } from "@/lib/chapter-reviews";

const idleState: ReviewActionState = { kind: "idle" };

function Stars({ rating }: { rating: number }) {
  return <span aria-label={`${rating} out of 5 stars`} title={`${rating} out of 5 stars`}>{"★".repeat(rating)}{"☆".repeat(5 - rating)}</span>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function ReviewForm({ workId, chapterId, review, onCancel, onSaved }: { workId: string; chapterId: string; review?: ChapterReview; onCancel?: () => void; onSaved?: () => void }) {
  const [state, action, pending] = useActionState(saveChapterReview, idleState);
  const router = useRouter();
  useEffect(() => {
    if (state.kind === "success") {
      onSaved?.();
      router.refresh();
    }
  }, [onSaved, router, state.kind]);
  return <form action={action} className="card">
    <input type="hidden" name="workId" value={workId}/>
    <input type="hidden" name="chapterId" value={chapterId}/>
    <fieldset>
      <legend>{review ? "Edit your rating" : "Rate this chapter"}</legend>
      <div role="radiogroup" aria-label="Rating from 1 to 5 stars">
        {[5, 4, 3, 2, 1].map((value) => <label key={value} className="text-action"><input type="radio" name="rating" value={value} defaultChecked={review?.rating === value || (!review && value === 5)} required/> {value} {value === 1 ? "star" : "stars"}</label>)}
      </div>
    </fieldset>
    <label htmlFor={`review-body-${chapterId}`}>Review <span className="muted">(optional)</span></label>
    <textarea id={`review-body-${chapterId}`} name="body" rows={4} maxLength={2000} defaultValue={review?.body ?? ""} placeholder="What stayed with you?"/>
    {state.kind === "error" && <p role="alert">{state.message}</p>}
    <div className="story-actions">
      <button type="submit" className="pill primary" disabled={pending}>{pending ? "Saving…" : review ? "Save review" : "Post review"}</button>
      {onCancel && <button type="button" className="pill" onClick={onCancel} disabled={pending}>Cancel</button>}
    </div>
  </form>;
}

export function ChapterReviews({ workId, chapterId, reviews, currentUserId, loginHref }: { workId: string; chapterId: string; reviews: ChapterReview[]; currentUserId?: string; loginHref: string }) {
  const [editing, setEditing] = useState(false);
  const [deleteState, deleteAction, deleting] = useActionState(deleteChapterReview, idleState);
  const router = useRouter();
  const ownReview = currentUserId ? reviews.find((review) => review.userId === currentUserId) : undefined;
  const average = reviews.length ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length : 0;

  useEffect(() => {
    if (deleteState.kind === "success") {
      setEditing(false);
      router.refresh();
    }
  }, [deleteState.kind, router]);

  return <section className="shell" aria-labelledby={`chapter-reviews-${chapterId}`}>
    <div className="section-head"><div><span className="eyebrow">Reader notes</span><h2 id={`chapter-reviews-${chapterId}`} className="serif">Ratings and reviews</h2></div><span className="muted">{reviews.length ? `${average.toFixed(1)} / 5 · ${reviews.length} ${reviews.length === 1 ? "review" : "reviews"}` : "No reviews yet"}</span></div>
    {currentUserId && !ownReview && !editing && <button type="button" className="pill primary" onClick={() => setEditing(true)}>Write a review</button>}
    {currentUserId && ownReview && !editing && <div className="story-actions"><button type="button" className="pill" onClick={() => setEditing(true)}>Edit your review</button><form action={deleteAction}><input type="hidden" name="workId" value={workId}/><input type="hidden" name="chapterId" value={chapterId}/><button type="submit" className="text-action" disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</button></form></div>}
    {currentUserId && editing && <ReviewForm
      workId={workId}
      chapterId={chapterId}
      review={ownReview}
      onCancel={() => setEditing(false)}
      onSaved={() => setEditing(false)}
    />}
    {!currentUserId && <p className="muted"><Link className="text-action" href={loginHref}>Sign in</Link> to leave the first review.</p>}
    {deleteState.kind === "error" && <p role="alert">{deleteState.message}</p>}
    {reviews.length > 0 && <div className="story-chapter-list">{reviews.map((review) => <article className="card" key={review.id}><div className="section-head"><strong>{review.userId === currentUserId ? "You" : review.author?.displayName ?? "Reader"}</strong><span className="muted"><Stars rating={review.rating}/> · {formatDate(review.createdAt)}</span></div>{review.body && <p>{review.body}</p>}</article>)}</div>}
  </section>;
}
