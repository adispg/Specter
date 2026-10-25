import localFont from "next/font/local";

/**
 * The type system in one file (design-system.md v1.1, section 3).
 * Display: the persona's voice and the brand. UI: everything the app says.
 * Mono: numbers only. Self-hosted (OFL) so builds and the PWA work offline.
 * To change a face, swap the file here; components only read the CSS variables.
 */
export const display = localFont({
  src: "./fonts/bricolage-grotesque-latin-opsz-normal.woff2",
  weight: "200 800",
  variable: "--font-display-src",
  display: "swap",
  fallback: ["Geist", "Segoe UI", "system-ui", "sans-serif"],
});

export const sans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  weight: "100 900",
  variable: "--font-sans-src",
  display: "swap",
  fallback: ["Segoe UI", "system-ui", "sans-serif"],
});

export const mono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  weight: "100 900",
  variable: "--font-mono-src",
  display: "swap",
  fallback: ["ui-monospace", "Consolas", "monospace"],
});

export const fontVariables = `${display.variable} ${sans.variable} ${mono.variable}`;
