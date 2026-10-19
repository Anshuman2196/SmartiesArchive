import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import type { RichDocument, RichNode } from "@/lib/rich-document";
import { isSecureMediaUrl } from "@/lib/reader-state";

const safeHref = (href: unknown) => typeof href === "string" && !/[\\\u0000-\u001f]/.test(href) && (href.startsWith("/") && !href.startsWith("//") || /^(https?:|mailto:)/i.test(href));

function renderMarks(children: ReactNode, marks: RichNode["marks"]) {
  return (marks ?? []).reduceRight<ReactNode>((child, mark) => {
    if (!mark) return child;
    if (mark.type === "bold") return <strong>{child}</strong>;
    if (mark.type === "italic") return <em>{child}</em>;
    if (mark.type === "underline") return <u>{child}</u>;
    if (mark.type === "strike") return <s>{child}</s>;
    if (mark.type === "code") return <code>{child}</code>;
    if (mark.type === "superscript") return <sup>{child}</sup>;
    if (mark.type === "subscript") return <sub>{child}</sub>;
    if (mark.type === "link" && safeHref(mark.attrs?.href)) return <a href={mark.attrs?.href as string}>{child}</a>;
    if (mark.type === "highlight") return <mark style={{ backgroundColor: typeof mark.attrs?.color === "string" ? mark.attrs.color : undefined }}>{child}</mark>;
    if (mark.type === "textStyle") {
      const style: CSSProperties = {};
      if (typeof mark.attrs?.color === "string") style.color = mark.attrs.color;
      if (typeof mark.attrs?.backgroundColor === "string") style.backgroundColor = mark.attrs.backgroundColor;
      if (typeof mark.attrs?.fontFamily === "string") style.fontFamily = mark.attrs.fontFamily;
      if (typeof mark.attrs?.fontSize === "string") style.fontSize = mark.attrs.fontSize;
      return <span style={style}>{child}</span>;
    }
    return child;
  }, children);
}

function renderNode(node: RichNode, key: string): ReactNode {
  const children = (node.content ?? []).map((child, index) => renderNode(child, `${key}.${index}`));
  const attrs = node.attrs ?? {};
  if (node.type === "text") return <span key={key}>{renderMarks(node.text ?? "", node.marks)}</span>;
  if (node.type === "doc") return <div key={key} className="rich-document">{children}</div>;
  const blockStyle = { textAlign: attrs.textAlign as CSSProperties["textAlign"], marginLeft: typeof attrs.indent === "number" && attrs.indent > 0 ? `${Math.min(attrs.indent, 4) * 24}px` : undefined };
  if (node.type === "paragraph") return <p key={key} style={blockStyle}>{children}</p>;
  if (node.type === "heading") {
    const style = blockStyle;
    if (attrs.level === 1) return <h1 key={key} style={style}>{children}</h1>;
    if (attrs.level === 2) return <h2 key={key} style={style}>{children}</h2>;
    return <h3 key={key} style={style}>{children}</h3>;
  }
  if (node.type === "bulletList") return <ul key={key}>{children}</ul>;
  if (node.type === "orderedList") return <ol key={key}>{children}</ol>;
  if (node.type === "listItem") return <li key={key}>{children}</li>;
  if (node.type === "blockquote") return <blockquote key={key}>{children}</blockquote>;
  if (node.type === "horizontalRule") return <hr key={key}/>;
  if (node.type === "hardBreak") return <br key={key}/>;
  if (node.type === "codeBlock") return <pre key={key}><code>{children}</code></pre>;
  if (node.type === "literaryBlock") return <section key={key} className={`literary-block literary-${String(attrs.treatment ?? "narration")}`} style={blockStyle} data-treatment={String(attrs.treatment ?? "narration")}>{children}</section>;
  if (node.type === "imageBlock") {
    const source = typeof attrs.previewSrc === "string" ? attrs.previewSrc : attrs.src;
    if (typeof source !== "string" || !isSecureMediaUrl(source)) return null;
    const width = typeof attrs.width === "number" ? Math.max(15, Math.min(attrs.width, 100)) : 100;
    const align = attrs.align === "left" || attrs.align === "right" ? attrs.align : "center";
    const figureStyle: CSSProperties = { width: `${width}%`, marginLeft: align === "right" ? "auto" : align === "center" ? "auto" : "0", marginRight: align === "left" ? "auto" : align === "center" ? "auto" : "0" };
    return <figure key={key} className="rich-figure" style={figureStyle}><Image src={source} width={1440} height={1100} unoptimized sizes="(max-width: 760px) 100vw, 900px" alt={typeof attrs.alt === "string" ? attrs.alt : ""}/>{typeof attrs.caption === "string" && attrs.caption && <figcaption>{attrs.caption}</figcaption>}</figure>;
  }
  return null;
}

export function RichDocumentRenderer({ document }: { document: RichDocument }) {
  return <>{renderNode(document, "doc")}</>;
}
