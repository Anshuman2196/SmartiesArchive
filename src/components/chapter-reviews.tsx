"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Star, Trash2 } from "lucide-react";
import { deleteChapterReview, saveChapterReview } from "@/app/actions";
import type { ChapterReview, ReviewActionState } from "@/lib/chapter-reviews";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import styles from "./chapter-reviews.module.css";

const idleState: ReviewActionState = { kind: "idle" };

function Stars({ rating }: { rating: number }) {
  return <span className={styles.stars} role="img" aria-label={`${rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} aria-hidden="true" fill={index < rating ? "currentColor" : "none"} data-filled={index < rating}/>)}</span>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function ReviewForm({ workId, chapterId, review, onSaved }: { workId: string; chapterId: string; review?: ChapterReview; onSaved: () => void }) {
  const [state, action, pending] = useActionState(saveChapterReview, idleState);
  const [rating, setRating] = useState(review?.rating.toString() ?? "");
  const router = useRouter();

  useEffect(() => {
    if (state.kind === "success") {
      onSaved();
      router.refresh();
    }
  }, [onSaved, router, state.kind]);

  return <form action={action} className={styles.form}>
    <input type="hidden" name="workId" value={workId}/>
    <input type="hidden" name="chapterId" value={chapterId}/>
    <FieldGroup>
      <FieldSet>
        <FieldLegend variant="label">Your rating</FieldLegend>
        <RadioGroup name="rating" value={rating} onValueChange={setRating} required className={styles.ratingGroup} aria-label="Rate this chapter from 1 to 5 stars">
          {[1, 2, 3, 4, 5].map((value) => <div key={value} className={styles.ratingChoice} data-filled={value <= Number(rating)}>
            <RadioGroupItem id={`review-rating-${chapterId}-${value}`} value={String(value)} aria-label={`${value} ${value === 1 ? "star" : "stars"}`} className="sr-only"/>
            <label htmlFor={`review-rating-${chapterId}-${value}`} title={`${value} ${value === 1 ? "star" : "stars"}`}><Star aria-hidden="true" fill={value <= Number(rating) ? "currentColor" : "none"}/></label>
          </div>)}
        </RadioGroup>
      </FieldSet>
      <Field><FieldLabel htmlFor={`review-body-${chapterId}`}>Your note <span className={styles.optional}>(optional)</span></FieldLabel><Textarea id={`review-body-${chapterId}`} name="body" rows={4} maxLength={2000} defaultValue={review?.body ?? ""} placeholder="What stayed with you?"/></Field>
    </FieldGroup>
    {state.kind === "error" && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
    <div className={styles.formActions}><DialogClose asChild><Button type="button" variant="ghost" disabled={pending}>Cancel</Button></DialogClose><Button type="submit" disabled={pending || !rating}>{pending ? "Saving…" : review ? "Save review" : "Post review"}</Button></div>
  </form>;
}

export function ChapterReviews({ workId, chapterId, reviews, currentUserId, loginHref }: { workId: string; chapterId: string; reviews: ChapterReview[]; currentUserId?: string; loginHref: string }) {
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteState, deleteAction, deleting] = useActionState(deleteChapterReview, idleState);
  const router = useRouter();
  const ownReview = currentUserId ? reviews.find((review) => review.userId === currentUserId) : undefined;
  const average = reviews.length ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length : 0;

  useEffect(() => {
    if (deleteState.kind === "success") {
      setDeleteOpen(false);
      router.refresh();
    }
  }, [deleteState.kind, router]);

  return <section className={`${styles.section} shell`} aria-labelledby={`chapter-reviews-${chapterId}`}>
    <div className={styles.layout}>
      <div className={styles.intro}>
        <span className="eyebrow">Reader notes</span>
        <h2 id={`chapter-reviews-${chapterId}`}>After the chapter</h2>
        {reviews.length > 0 && <div className={styles.aggregate}><Star aria-hidden="true" fill="currentColor"/><strong>{average.toFixed(1)}</strong><span>from {reviews.length} {reviews.length === 1 ? "review" : "reviews"}</span></div>}
        {currentUserId && !ownReview && <Button variant="outline" onClick={() => setEditing(true)}>Write a review</Button>}
        {!currentUserId && <p className={styles.signIn}><Link href={loginHref}>Sign in</Link> to leave a review.</p>}
      </div>

      <div className={styles.list}>
        {reviews.length === 0 && <p className={styles.empty}>No reviews yet. Be the first to leave a note on this chapter.</p>}
        {reviews.map((review) => <article className={styles.review} key={review.id}>
          <div className={styles.reviewTop}>
            <div className={styles.reviewByline}><strong>{review.userId === currentUserId ? "You" : review.author?.username ? <Link href={`/author/${review.author.username}`}>{review.author.displayName}</Link> : review.author?.displayName ?? "Reader"}</strong><time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time></div>
            <div className={styles.reviewMeta}><Stars rating={review.rating}/>
              {review.userId === currentUserId && <div className={styles.ownActions}>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit your review" onClick={() => setEditing(true)}><Pencil/></Button>
                <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                  <AlertDialogTrigger asChild><Button type="button" variant="ghost" size="icon-sm" aria-label="Delete your review"><Trash2/></Button></AlertDialogTrigger>
                  <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete your review?</AlertDialogTitle><AlertDialogDescription>Your rating and note will be removed from this chapter.</AlertDialogDescription></AlertDialogHeader>
                    {deleteState.kind === "error" && <Alert variant="destructive"><AlertDescription>{deleteState.message}</AlertDescription></Alert>}
                    <AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel><form action={deleteAction}><input type="hidden" name="workId" value={workId}/><input type="hidden" name="chapterId" value={chapterId}/><Button type="submit" variant="destructive" disabled={deleting}>{deleting ? "Deleting…" : "Delete review"}</Button></form></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>}
            </div>
          </div>
          {review.body && <p className={styles.reviewBody}>{review.body}</p>}
        </article>)}
      </div>
    </div>

    {currentUserId && <Dialog open={editing} onOpenChange={setEditing}><DialogContent className={styles.composeDialog}><DialogHeader><DialogTitle>{ownReview ? "Edit your review" : "Review this chapter"}</DialogTitle><DialogDescription>Rate the chapter and add a note if you like.</DialogDescription></DialogHeader><ReviewForm workId={workId} chapterId={chapterId} review={ownReview} onSaved={() => setEditing(false)}/></DialogContent></Dialog>}
  </section>;
}
