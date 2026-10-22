"use client";

import { finishStoryMediaUpload, prepareStoryMediaUpload } from "@/app/actions";
import { maxStoryImageBytes, maxStoryPdfBytes } from "@/lib/image-validation";

const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const pdfType = "application/pdf";

export async function uploadStoryMediaFile(workId: string, file: File, onProgress?: (percent: number) => void) {
  const isPdf = file.type === pdfType;
  const maxBytes = isPdf ? maxStoryPdfBytes : maxStoryImageBytes;
  if ((!supportedTypes.has(file.type) && !isPdf) || file.size < 1 || file.size > maxBytes) {
    return { ok: false as const, message: isPdf ? "Choose a PDF under 50 MB." : "Choose a JPEG, PNG, WebP, or GIF image under 8 MB." };
  }
  const header = Array.from(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  const prepared = await prepareStoryMediaUpload(workId, file.name, file.type, file.size, header);
  if (!prepared.ok || !prepared.path || !prepared.token) return { ok: false as const, message: prepared.message ?? "The secure upload could not be prepared." };
  const path = prepared.path;
  const token = prepared.token;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return { ok: false as const, message: "Media storage is not configured for this deployment." };
  const uploaded = await new Promise<boolean>((resolve) => {
    const request = new XMLHttpRequest();
    request.open("PUT", `${baseUrl.replace(/\/$/, "")}/storage/v1/object/upload/sign/story-media/${path.split("/").map(encodeURIComponent).join("/")}?token=${encodeURIComponent(token)}`);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100)); };
    request.onload = () => resolve(request.status >= 200 && request.status < 300);
    request.onerror = () => resolve(false);
    request.onabort = () => resolve(false);
    request.send(file);
  });
  if (!uploaded) return { ok: false as const, message: "The media upload failed. Check your connection and try again." };
  onProgress?.(100);
  return finishStoryMediaUpload(workId, path);
}
