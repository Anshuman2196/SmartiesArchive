import type { SupabaseClient } from "@supabase/supabase-js";
import type { RichNode } from "@/lib/rich-document";

const bucket = "story-media";
const mediaPathPattern = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpe?g|webp|gif|pdf)$/i;

function normalizeMediaReference(reference: string | null | undefined): { reference: string; path?: string } | null {
  if (!reference) return null;
  const prefix = `storage://${bucket}/`;
  if (!reference.startsWith(prefix)) return reference.startsWith("https://") ? { reference } : null;
  const path = reference.slice(prefix.length);
  return mediaPathPattern.test(path) ? { reference, path } : null;
}

export async function signStoryMediaUrls(supabase: SupabaseClient, references: Array<string | null | undefined>, expiresIn = 3600): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const paths = new Map<string, string>();

  for (const reference of references) {
    const normalized = normalizeMediaReference(reference);
    if (!normalized) {
      if (reference) result.set(reference, null);
      continue;
    }
    if (normalized.path) paths.set(normalized.path, normalized.reference);
    else result.set(normalized.reference, normalized.reference);
  }

  if (paths.size > 0) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls([...paths.keys()], expiresIn);
    if (!error) {
      for (const item of data ?? []) {
        if (!item.path) continue;
        const reference = paths.get(item.path);
        if (reference) result.set(reference, item.signedUrl ?? null);
      }
    }
  }

  for (const reference of references) {
    if (reference && !result.has(reference)) result.set(reference, null);
  }
  return result;
}

export async function signStoryMediaUrl(supabase: SupabaseClient, reference: string | null | undefined): Promise<string | null> {
  if (!reference) return null;
  return (await signStoryMediaUrls(supabase, [reference])).get(reference) ?? null;
}

export async function signRichDocument(value: unknown, supabase: SupabaseClient): Promise<unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const references: string[] = [];
  const collect = (nodeValue: unknown) => {
    if (typeof nodeValue !== "object" || nodeValue === null || Array.isArray(nodeValue)) return;
    const node = nodeValue as RichNode;
    if (node.type === "imageBlock" && typeof node.attrs?.src === "string") references.push(node.attrs.src);
    node.content?.forEach(collect);
  };
  collect(value);
  const signedUrls = await signStoryMediaUrls(supabase, references);
  const replace = (nodeValue: unknown): unknown => {
    if (typeof nodeValue !== "object" || nodeValue === null || Array.isArray(nodeValue)) return nodeValue;
    const node = nodeValue as RichNode;
    const content = node.content?.map(replace);
    if (node.type !== "imageBlock" || !node.attrs || typeof node.attrs.src !== "string") return { ...node, ...(content ? { content } : {}) };
    const previewSrc = signedUrls.get(node.attrs.src);
    return { ...node, attrs: { ...node.attrs, ...(previewSrc ? { previewSrc } : {}) }, ...(content ? { content } : {}) };
  };
  return replace(value);
}
