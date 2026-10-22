import type { RichDocument, RichNode } from "./rich-document.ts";

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

const inlineMarkdownSyntax = /\*\*[^*\n]+\*\*|__[^_\n]+__|(?<!\*)\*[^*\n]+\*(?!\*)|(?<!_)_[^_\n]+_(?!_)|~~[^~\n]+~~|`[^`\n]+`|\[[^\]]+\]\([^)]+\)/;

/** Parse literal inline Markdown even inside headings, quotes, lists, and literary blocks. */
export function expandInlineMarkdown(document: RichDocument, parse: (source: string) => RichDocument): { document: RichDocument; changed: boolean } {
  let changed = false;
  const walk = (node: RichNode, parentType: string): RichNode[] => {
    if (node.type === "text" && parentType !== "codeBlock" && typeof node.text === "string" && inlineMarkdownSyntax.test(node.text) && !node.marks?.some((mark) => mark.type === "code" || mark.type === "link")) {
      const parsed = parse(node.text);
      const blocks = parsed.content ?? [];
      const inline = blocks.length === 1 && blocks[0].type === "paragraph" ? blocks[0].content ?? [] : [];
      if (inline.length && inline.every((child) => child.type === "text") && inline.map((child) => child.text ?? "").join("") !== node.text) {
        changed = true;
        return inline.map((child) => ({ ...child, marks: [...(node.marks ?? []), ...(child.marks ?? [])].filter((mark, index, marks) => marks.findIndex((item) => item.type === mark.type) === index) }));
      }
    }
    if (!node.content?.length || node.type === "codeBlock") return [node];
    return [{ ...node, content: node.content.flatMap((child) => walk(child, node.type)) }];
  };
  return { document: { type: "doc", content: document.content.flatMap((node) => walk(node, "doc")) }, changed };
}
