"use client";

import { useEffect, useRef, useState } from "react";

type Tip = { text: string; x: number; y: number; below: boolean };

// One shared tooltip for every element with data-tooltip, so icon-only controls explain themselves on hover and keyboard focus.
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
    const hide = () => { clear(); setTip(null); };
    const show = (target: HTMLElement, delay: number) => {
      clear();
      const text = target.dataset.tooltip;
      if (!text) return;
      timer.current = setTimeout(() => {
        const rect = target.getBoundingClientRect();
        const below = rect.top < 48;
        setTip({ text, x: Math.min(Math.max(rect.left + rect.width / 2, 12), window.innerWidth - 12), y: below ? rect.bottom + 8 : rect.top - 8, below });
      }, delay);
    };
    // Native titles are adopted into the styled tooltip so the browser does not show a second one.
    const find = (node: EventTarget | null) => {
      const target = node instanceof Element ? node.closest<HTMLElement>("[data-tooltip], button[title], a[title], summary[title]") : null;
      if (target?.title) { target.dataset.tooltip = target.title; target.removeAttribute("title"); }
      return target;
    };
    const onOver = (event: PointerEvent) => { if (event.pointerType === "touch") return; const target = find(event.target); if (target) show(target, 350); };
    const onOut = (event: PointerEvent) => { const target = find(event.target); if (target && !target.contains(event.relatedTarget as Node | null)) hide(); };
    const onFocus = (event: FocusEvent) => { const target = find(event.target); if (target && target.matches(":focus-visible")) show(target, 0); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") hide(); };
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, true);
    return () => {
      clear();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  if (!tip) return null;
  return <div className="app-tooltip" data-side={tip.below ? "bottom" : "top"} aria-hidden="true" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>;
}
