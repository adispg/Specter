/**
 * Relative timestamps for lists ("now", "4m", "3h", "2d", then a date).
 *
 * Deliberately its own module rather than part of components/ui.tsx. ui.tsx is
 * a "use client" module, and the cases and saved lists are server components:
 * importing a plain function across that boundary made Next treat it as a
 * client function called from the server, which threw at render time and put
 * "Application error: a server-side exception has occurred" on screen for any
 * user who actually had a case or a saved line.
 */
export function relTime(iso: string, now = Date.now()): string {
  const d = new Date(iso).getTime();
  const s = Math.max(0, Math.round((now - d) / 1000));
  if (s < 60) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
