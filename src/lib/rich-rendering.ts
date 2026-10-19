import type { RichNode } from "./rich-document.ts";

export function richNodeTag(node: RichNode): string | null {
  switch (node.type) {
    case "doc": return "div";
    case "text": return "span";
    case "paragraph": return "p";
    case "heading": return node.attrs?.level === 1 ? "h1" : node.attrs?.level === 2 ? "h2" : node.attrs?.level === 3 ? "h3" : null;
    case "bulletList": return "ul";
    case "orderedList": return "ol";
    case "listItem": return "li";
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
  const tags: Record<string, string> = { bold: "strong", italic: "em", underline: "u", strike: "s", code: "code", highlight: "mark", textStyle: "span", link: "a", superscript: "sup", subscript: "sub" };
  return tags[type] ?? null;
}
