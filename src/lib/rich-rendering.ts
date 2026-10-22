import type { RichNode } from "./rich-document.ts";

export function richNodeTag(node: RichNode): string | null {
  switch (node.type) {
    case "doc": return "div";
    case "text": return "span";
    case "paragraph": return "p";
    case "heading": return Number(node.attrs?.level) === 1 ? "h2" : [2, 3, 4, 5, 6].includes(Number(node.attrs?.level)) ? `h${Math.min(Number(node.attrs?.level), 6)}` : null;
    case "bulletList": return "ul";
    case "orderedList": return "ol";
    case "listItem": return "li";
    case "taskList": return "ul";
    case "taskItem": return "li";
    case "table": return "table";
    case "tableRow": return "tr";
    case "tableCell": return "td";
    case "tableHeader": return "th";
    case "blockquote": return "blockquote";
    case "horizontalRule": return "hr";
    case "codeBlock": return "pre";
    case "hardBreak": return "br";
    case "literaryBlock": return "section";
    case "imageBlock": return "figure";
    default: return null;
  }
}

export function richMarkTag(type: string): string | null {
  const tags: Record<string, string> = { bold: "strong", italic: "em", underline: "u", strike: "s", code: "code", highlight: "mark", textStyle: "span", link: "a", superscript: "sup", subscript: "sub", spoiler: "span" };
  return tags[type] ?? null;
}
