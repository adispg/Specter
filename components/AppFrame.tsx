"use client";
import type { CSSProperties, ReactNode } from "react";
import { PERSONAS, themeVars } from "@/lib/personas/config";
import { useApp } from "./AppProvider";

/** The app root: paints the background recipe and re-tints everything for the active persona. */
export function AppFrame({ children, neutral = false }: { children: ReactNode; neutral?: boolean }) {
  const { persona } = useApp();
  const style = neutral ? undefined : (themeVars(PERSONAS[persona].theme) as CSSProperties);
  return (
    <div className="app" data-persona={neutral ? "neutral" : persona} style={style}>
      {children}
    </div>
  );
}
