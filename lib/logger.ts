/**
 * Structured logger for server-side use.
 *
 * Emits newline-delimited JSON to stdout. Vercel captures stdout and indexes
 * JSON log lines, making them searchable by field in the dashboard and
 * queryable via log drain. Plain console.log strings are opaque; JSON lines
 * are not.
 *
 * Usage:
 *   import { log } from "@/lib/logger";
 *   log.info("consult.complete", { persona, latencyMs, tokens });
 *   log.warn("tts.cache_miss", { hash });
 *   log.error("llm.failed", { code, status, message });
 *
 * All fields in `meta` are merged into the top-level log object alongside
 * `level`, `event`, and `ts`. Never pass user content (situation text,
 * replies) as meta — only counts, IDs, codes, and durations.
 */

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, event: string, meta: Record<string, unknown> = {}): void {
  // In test environments just use the underlying console method.
  if (process.env.NODE_ENV === "test") {
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
    fn(`[${event}]`, meta);
    return;
  }
  try {
    process.stdout.write(
      JSON.stringify({ level, event, ts: new Date().toISOString(), ...meta }) + "\n",
    );
  } catch {
    // Fallback: stdout can be unavailable in edge runtime contexts.
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(JSON.stringify({ level, event, ...meta }));
  }
}

export const log = {
  debug: (event: string, meta?: Record<string, unknown>) => emit("debug", event, meta),
  info:  (event: string, meta?: Record<string, unknown>) => emit("info",  event, meta),
  warn:  (event: string, meta?: Record<string, unknown>) => emit("warn",  event, meta),
  error: (event: string, meta?: Record<string, unknown>) => emit("error", event, meta),
};
