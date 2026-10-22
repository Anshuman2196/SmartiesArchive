"use client";

import type { CSSProperties } from "react";
import { Toaster } from "sonner";

const toasterStyle = { "--normal-bg": "var(--panel)", "--normal-text": "var(--cream)", "--normal-border": "var(--line)", fontFamily: "var(--font-ui)" } as CSSProperties;

export function AppToaster() {
  return <Toaster theme="dark" position="bottom-right" closeButton duration={5000} style={toasterStyle}/>;
}
