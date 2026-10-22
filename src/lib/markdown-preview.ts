import type { RichDocument } from "./rich-document.ts";

const markdownSyntax = /(^|\n)\s{0,3}(?:#{1,6}\s|>\s|[-*+]\s|\d+\.\s|`{3,}|~{3,}|\|[^\n]*\||-{3,}\s*$)|\*\*\S[^*]*\*\*|__\S[^_]*__|(?<!\*)\*\S[^*\n]*\*(?!\*)|(?<!_)_\S[^_\n]*_(?!_)|~~\S[^~]*~~|\[[^\]]+\]\([^)]+\)|`[^`\n]+`/m;

function plainParagraphSource(paragraph: RichDocument["content"][number]): string | null {
  if (paragraph.type !== "paragraph" || paragraph.attrs?.textAlign != null || Number(paragraph.attrs?.indent ?? 0) !== 0) return null;
  let source = "";
  for (const node of paragraph.content ?? []) {
    if (node.marks?.length) return null;
    if (node.type === "text") source += node.text ?? "";
    else if (node.type === "hardBreak") source += "\n";
    else return null;
  }
  return source;
}

/** Find plain-text spans that contain Markdown, leaving formatted editor blocks intact. */
export function markdownRunsForPreview(document: RichDocument): Array<{ start: number; end: number; source: string }> {
  const runs: Array<{ start: number; end: number; source: string }> = [];
  let start = 0;
  let paragraphs: string[] = [];
  const flush = (end: number) => {
    const source = paragraphs.join("\n\n");
    if (markdownSyntax.test(source)) runs.push({ start, end, source });
    paragraphs = [];
  };
  document.content.forEach((node, index) => {
    const source = plainParagraphSource(node);
    if (source === null) { if (paragraphs.length) flush(index); return; }
    if (!paragraphs.length) start = index;
    paragraphs.push(source);
  });
  if (paragraphs.length) flush(document.content.length);
  return runs;
}
