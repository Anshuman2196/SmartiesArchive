import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const progressPayload = z.object({
  workId: z.uuid(),
  chapterId: z.uuid(),
  progress: z.number().finite().min(0).max(1),
});

export async function POST(request: Request) {
  const parsed = progressPayload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { error } = await supabase.from("reading_progress").upsert({
    user_id: user.id,
    work_id: parsed.data.workId,
    chapter_id: parsed.data.chapterId,
    progress: parsed.data.progress,
  }, { onConflict: "user_id,work_id" });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
