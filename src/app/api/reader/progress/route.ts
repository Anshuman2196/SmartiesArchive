import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { persistReadingProgress } from "@/lib/reading-progress";

const progressPayload = z.object({
  workId: z.uuid(),
  chapterId: z.uuid(),
  progress: z.number().finite().min(0).max(1),
});

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  let sameOrigin = false;
  try { sameOrigin = !!origin && new URL(origin).origin === new URL(request.url).origin; } catch { /* Reject malformed or opaque origins. */ }
  if (!sameOrigin) return NextResponse.json({ ok: false }, { status: 403 });

  const parsed = progressPayload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const saved = await persistReadingProgress(supabase, user.id, parsed.data.workId, parsed.data.chapterId, parsed.data.progress);
  if (!saved) return NextResponse.json({ ok: false }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
