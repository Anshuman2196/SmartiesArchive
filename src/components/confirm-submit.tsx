"use client";

import type { MouseEvent, ReactNode } from "react";

export function ConfirmSubmit({ children, phrase, className = "danger-button" }: { children: ReactNode; phrase: string; className?: string }) {
  const ask = (event: MouseEvent<HTMLButtonElement>) => { if (!window.confirm(phrase)) event.preventDefault(); };
  return <button type="submit" className={className} onClick={ask}>{children}</button>;
}
