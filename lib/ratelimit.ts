/**
 * Quotas, counted from usage_events.
 * - Free tier: N billable consults per week (PRD section 10, H1), window starts Monday 00:00 UTC.
 * - Hard caps per user per day for consults, TTS and STT (abuse and cost guard).
 */

export type QuotaWindow = "day" | "week";

export type QuotaDecision = {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  window: QuotaWindow;
  /** ISO time the window resets. */
  resetAt: string;
  /** Seconds until reset, for Retry-After. */
  retryAfter: number;
};

export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Monday 00:00 UTC of the current week. */
export function startOfUtcWeek(now: Date): Date {
  const d = startOfUtcDay(now);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

export function windowStart(now: Date, window: QuotaWindow): Date {
  return window === "week" ? startOfUtcWeek(now) : startOfUtcDay(now);
}

export function windowEnd(now: Date, window: QuotaWindow): Date {
  const d = windowStart(now, window);
  d.setUTCDate(d.getUTCDate() + (window === "week" ? 7 : 1));
  return d;
}

/** Back-compat helper. */
export function nextUtcDay(now: Date): Date {
  return windowEnd(now, "day");
}

/**
 * Decide whether one more unit is allowed. A limit of 0 means unlimited (useful
 * for local development). `remaining` is what is left after this unit.
 */
export function checkQuota(used: number, limit: number, now: Date = new Date(), window: QuotaWindow = "day"): QuotaDecision {
  const reset = windowEnd(now, window);
  const retryAfter = Math.max(1, Math.ceil((reset.getTime() - now.getTime()) / 1000));
  const safeUsed = Math.max(0, Math.floor(Number.isFinite(used) ? used : 0));
  if (!Number.isFinite(limit) || limit <= 0) {
    return { allowed: true, limit: 0, used: safeUsed, remaining: Number.POSITIVE_INFINITY, window, resetAt: reset.toISOString(), retryAfter };
  }
  const allowed = safeUsed < limit;
  return {
    allowed,
    limit,
    used: safeUsed,
    remaining: Math.max(0, limit - safeUsed - (allowed ? 1 : 0)),
    window,
    resetAt: reset.toISOString(),
    retryAfter,
  };
}

export function quotaHeaders(q: QuotaDecision): Record<string, string> {
  const h: Record<string, string> = { "X-RateLimit-Reset": q.resetAt };
  if (q.limit > 0) {
    h["X-RateLimit-Limit"] = String(q.limit);
    h["X-RateLimit-Remaining"] = String(q.remaining);
  }
  if (!q.allowed) h["Retry-After"] = String(q.retryAfter);
  return h;
}
