import type { LiteraryTreatment, RichNode } from "./rich-document";

function paragraphText(node: RichNode): string {
  return (node.content ?? []).map((child) => child.type === "text" ? child.text ?? "" : child.type === "hardBreak" ? "\n" : "").join("").trim();
}

export function detectLiteraryTreatment(node: RichNode): LiteraryTreatment | null {
  if (node.type !== "paragraph") return null;
  const text = paragraphText(node);
  if (!text) return null;

  // Only use visible, fairly unambiguous cues. Ordinary prose stays narration.
  if (/^(?:[“"«].+[”"»](?:\s*[.!?])?|[“"«].+[”"»]\s+(?:\w+\s+){0,3}(?:said|asked|replied|whispered|shouted|murmured)\b.*|[—–]\s*\S.+)$/.test(text)) return "dialogue";
  if (/^Dear\s+[^\n,]{2,60},?$/i.test(text) || /^(?:Sincerely|Yours truly|Yours sincerely),?$/i.test(text)) return "letter";
  if (/^\[(?:system|notice|alert)\s*[:\]]/i.test(text)) return "system";
  return null;
}
