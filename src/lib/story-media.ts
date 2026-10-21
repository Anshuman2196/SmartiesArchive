import type { SupabaseClient } from "@supabase/supabase-js";
import type { RichNode } from "@/lib/rich-document";

const bucket = "story-media";

export async function signStoryMediaUrl(supabase: SupabaseClient, reference: string | null | undefined): Promise<string | null> {
  if (!reference) return null;
  const prefix = `storage://${bucket}/`;
  if (!reference.startsWith(prefix)) return reference.startsWith("https://") ? reference : null;
  const path = reference.slice(prefix.length);
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpe?g|webp|gif|pdf)$/i.test(path)) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}

export async function signRichDocument(value: unknown, supabase: SupabaseClient): Promise<unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const node = value as RichNode;
  const content = await Promise.all((node.content ?? []).map((child) => signRichDocument(child, supabase) as Promise<RichNode>));
  if (node.type !== "imageBlock" || !node.attrs || typeof node.attrs.src !== "string") return { ...node, ...(node.content ? { content } : {}) };
  const previewSrc = await signStoryMediaUrl(supabase, node.attrs.src);
  return { ...node, attrs: { ...node.attrs, ...(previewSrc ? { previewSrc } : {}) }, ...(node.content ? { content } : {}) };
}
