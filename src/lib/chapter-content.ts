import { z } from "zod";
import { validateRichDocument, type RichDocument } from "./rich-document.ts";

export const chapterFormats = ["prose", "image", "comic", "chat", "mixed"] as const;
export type ChapterFormat = (typeof chapterFormats)[number];

const secureUrl = z.string().url().refine((value) => new URL(value).protocol === "https:", "Use an HTTPS media URL.");
const proseBlock = z.object({ type: z.literal("prose"), text: z.string().min(1).max(100_000) });
const imageBlock = z.object({ type: z.literal("image"), url: secureUrl, alt: z.string().max(300).default("") });
const chatBlock = z.object({ type: z.literal("chat"), messages: z.array(z.object({ speaker: z.string().min(1).max(60), text: z.string().min(1).max(2000) })).min(1).max(500) });
const comicBlock = z.object({ type: z.literal("comic"), panels: z.array(z.object({ url: secureUrl, alt: z.string().max(300).default("") })).min(1).max(100) });
const mixedItem = z.discriminatedUnion("type", [proseBlock, imageBlock, chatBlock]);
const readerContentSchema = z.discriminatedUnion("type", [
  proseBlock,
  imageBlock,
  chatBlock,
  comicBlock,
  z.object({ type: z.literal("mixed"), blocks: z.array(mixedItem).min(1).max(200) }),
]);

export type ReaderContent = z.infer<typeof readerContentSchema> | { type: "rich"; document: RichDocument };

const validLines = (source: string) => source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

export function buildChapterContent(format: ChapterFormat, source: string, alt = ""): { body: string; content: ReaderContent } {
  if (format === "prose") return { body: source, content: { type: "prose", text: source } };
  if (format === "image") {
    const content = readerContentSchema.parse({ type: "image", url: source.trim(), alt: alt.trim() });
    return { body: source.trim(), content };
  }
  if (format === "comic") {
    const panels = validLines(source).map((line) => {
      const [url, ...caption] = line.split("|");
      return { url: url.trim(), alt: caption.join("|").trim() };
    });
    const content = readerContentSchema.parse({ type: "comic", panels });
    return { body: source, content };
  }
  if (format === "chat") {
    const messages = validLines(source).map((line) => {
      const separator = line.indexOf(":");
      if (separator < 1) throw new Error("Write each message as Speaker: message.");
      return { speaker: line.slice(0, separator).trim(), text: line.slice(separator + 1).trim() };
    });
    const content = readerContentSchema.parse({ type: "chat", messages });
    return { body: source, content };
  }
  let parsed: unknown;
  try { parsed = JSON.parse(source); }
  catch { throw new Error('Mixed media must be a JSON array of prose, image, or chat blocks.'); }
  const content = readerContentSchema.parse({ type: "mixed", blocks: parsed });
  return { body: source, content };
}

export function normalizeReaderContent(value: unknown, body: string, ownerId?: string, workId?: string): ReaderContent {
  if (typeof value === "object" && value !== null && (value as { type?: string }).type === "rich" && ownerId && workId) {
    try { return { type: "rich", document: validateRichDocument((value as { document?: unknown }).document, ownerId, workId).document }; }
    catch { return { type: "prose", text: body }; }
  }
  const parsed = readerContentSchema.safeParse(value);
  return parsed.success ? parsed.data : { type: "prose", text: body };
}
