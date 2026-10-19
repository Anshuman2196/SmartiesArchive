import { createElement, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import type { RichDocument, RichNode } from "@/lib/rich-document";
import { isSecureMediaUrl } from "@/lib/reader-state";
import { richMarkTag, richNodeTag } from "@/lib/rich-rendering";
import { SpoilerReveal } from "@/components/spoiler-reveal";

const safeHref = (href: unknown) => typeof href === "string" && !/[\\\u0000-\u001f]/.test(href) && (href.startsWith("/") && !href.startsWith("//") || /^(https?:|mailto:)/i.test(href));

function renderMarks(children: ReactNode, marks: RichNode["marks"]) {
  return (marks ?? []).reduceRight<ReactNode>((child, mark) => {
    if (!mark) return child;
    const tag = richMarkTag(mark.type);
    if (!tag) return child;
    if (mark.type === "spoiler") return createElement(SpoilerReveal, null, child);
    if (mark.type === "link" && safeHref(mark.attrs?.href)) return createElement(tag, { href: mark.attrs?.href as string }, child);
    if (mark.type === "highlight") return createElement(tag, { style: { backgroundColor: typeof mark.attrs?.color === "string" ? mark.attrs.color : undefined } }, child);
    if (mark.type === "textStyle") {
      const style: CSSProperties = {};
      if (typeof mark.attrs?.color === "string") style.color = mark.attrs.color;
      if (typeof mark.attrs?.backgroundColor === "string") style.backgroundColor = mark.attrs.backgroundColor;
      if (typeof mark.attrs?.fontFamily === "string") style.fontFamily = mark.attrs.fontFamily;
      if (typeof mark.attrs?.fontSize === "string") style.fontSize = mark.attrs.fontSize;
      return createElement(tag, { style }, child);
    }
    return createElement(tag, null, child);
  }, children);
}

function renderNode(node: RichNode, key: string): ReactNode {
  const children = (node.content ?? []).map((child, index) => renderNode(child, `${key}.${index}`));
  const attrs = node.attrs ?? {};
  if (node.type === "text") return createElement(richNodeTag(node)!, { key }, renderMarks(node.text ?? "", node.marks));
  if (node.type === "doc") return createElement(richNodeTag(node)!, { key, className: "rich-document" }, children);
  const blockStyle = { textAlign: attrs.textAlign as CSSProperties["textAlign"], marginLeft: typeof attrs.indent === "number" && attrs.indent > 0 ? `${Math.min(attrs.indent, 4) * 24}px` : undefined };
  if (node.type === "paragraph") return createElement(richNodeTag(node)!, { key, style: blockStyle }, children);
  if (node.type === "heading") {
    const style = blockStyle;
    const tag = richNodeTag(node);
    return tag ? createElement(tag, { key, style }, children) : null;
  }
  if (node.type === "bulletList") return createElement(richNodeTag(node)!, { key }, children);
  if (node.type === "orderedList") return createElement(richNodeTag(node)!, { key, start: typeof attrs.start === "number" ? attrs.start : undefined }, children);
  if (node.type === "listItem") return createElement(richNodeTag(node)!, { key }, children);
  if (node.type === "blockquote") return createElement(richNodeTag(node)!, { key }, children);
  if (node.type === "horizontalRule") return createElement(richNodeTag(node)!, { key });
  if (node.type === "hardBreak") return createElement(richNodeTag(node)!, { key });
  if (node.type === "codeBlock") return createElement(richNodeTag(node)!, { key }, <code className={typeof attrs.language === "string" ? `language-${attrs.language}` : undefined}>{children}</code>);
  if (node.type === "literaryBlock") return createElement(richNodeTag(node)!, { key, className: `literary-block literary-${String(attrs.treatment ?? "narration")}`, style: blockStyle, "data-treatment": String(attrs.treatment ?? "narration") }, children);
  if (node.type === "imageBlock") {
    const source = typeof attrs.previewSrc === "string" ? attrs.previewSrc : attrs.src;
    if (typeof source !== "string" || !isSecureMediaUrl(source)) return null;
    const width = typeof attrs.width === "number" ? Math.max(15, Math.min(attrs.width, 100)) : 100;
    const align = attrs.align === "left" || attrs.align === "right" ? attrs.align : "center";
    const figureStyle: CSSProperties = { width: `${width}%`, marginLeft: align === "right" ? "auto" : align === "center" ? "auto" : "0", marginRight: align === "left" ? "auto" : align === "center" ? "auto" : "0" };
    return createElement(richNodeTag(node)!, { key, className: "rich-figure", style: figureStyle }, <Image src={source} width={1440} height={1100} unoptimized sizes="(max-width: 760px) 100vw, 900px" alt={typeof attrs.alt === "string" ? attrs.alt : ""}/>, typeof attrs.caption === "string" && attrs.caption ? <figcaption>{attrs.caption}</figcaption> : null);
  }
  return null;
}

export function RichDocumentRenderer({ document }: { document: RichDocument }) {
  return <>{renderNode(document, "doc")}</>;
}
