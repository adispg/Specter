import type { CSSProperties, ReactNode } from "react";
import { NEUTRAL_GLYPH, NEUTRAL_THEME, PERSONAS, themeVars, type PersonaId, type Theme } from "@/lib/personas/config";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";

/**
 * Persona avatar: gradient disc with the persona's geometric mark from config.
 * The only place persona marks are rendered, so a new character (or a new avatar
 * style) is a config or one-component change. Decorative: the adjacent name carries meaning.
 */
export function Avatar({
  persona,
  size = "md",
  halo = 0,
  className = "",
  style,
}: {
  persona: PersonaId | "neutral";
  size?: AvatarSize;
  /** Number of halo rings (0, 1 or 2). They animate when an ancestor has .speaking/.listening. */
  halo?: 0 | 1 | 2;
  className?: string;
  style?: CSSProperties;
}) {
  const glyph = persona === "neutral" ? NEUTRAL_GLYPH : PERSONAS[persona].glyph;
  const theme = persona === "neutral" ? NEUTRAL_THEME : PERSONAS[persona].theme;
  return (
    <span
      className={`av ${size} ${className}`}
      aria-hidden="true"
      style={{ ...(themeVars(theme) as CSSProperties), ...style }}
      data-persona={persona}
    >
      <svg className="gl" viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: glyph }} />
      {halo >= 1 && <i className="halo" />}
      {halo >= 2 && <i className="halo h2" />}
    </span>
  );
}

/** Re-tints a subtree for a persona (or the neutral system/safety theme) by setting the slot variables. */
export function PersonaTheme({
  persona,
  as: Tag = "div",
  className,
  children,
  style,
}: {
  persona: PersonaId | "neutral";
  as?: "div" | "section" | "article" | "span" | "li" | "main";
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const theme: Theme = persona === "neutral" ? NEUTRAL_THEME : PERSONAS[persona].theme;
  return (
    <Tag data-persona={persona} className={className} style={{ ...(themeVars(theme) as CSSProperties), ...style }}>
      {children}
    </Tag>
  );
}
