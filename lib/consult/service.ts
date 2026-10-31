import type { DataStore, GuestThrottle } from "@/lib/data/store";
import { kindForAction, type ConsultRow, type Plan } from "@/lib/data/types";
import type { Intensity } from "@/lib/personas/config";
import { PROMPT_VERSION } from "@/lib/personas/rules";
import { buildTurns } from "@/lib/personas/prompt";
import { checkQuota, windowStart } from "@/lib/ratelimit";
import { ConsultError, generateReply } from "./engine";
import type { LlmClient, Usage } from "./llm";
import { careReply, detectCrisis, effectiveIntensity, type SafetyCategory } from "./safety";
import { log } from "@/lib/logger";
import { ConsultRequestSchema, type ConsultRequest, type Reply } from "./schema";

export type ConsultLimits = {
  freeConsultsPerWeek: number;
  freeFollowupsPerCase: number;
  consultDailyCap: number;
  guestConsults: number;
  guestPerDevice: number;
  guestPerIp: number;
};

export const DEFAULT_LIMITS: ConsultLimits = {
  freeConsultsPerWeek: 3,
  freeFollowupsPerCase: 5,
  consultDailyCap: 40,
  guestConsults: 1,
  guestPerDevice: 1,
  guestPerIp: 5,
};

export type ConsultContext = {
  store: DataStore;
  llm: LlmClient;
  request: ConsultRequest;
  plan: Plan;
  isGuest: boolean;
  limits: ConsultLimits;
  country?: string | null;
  /** Hashed device and IP keys, for the guest throttle. */
  guest?: { throttle: GuestThrottle; deviceKey: string | null; ipKey: string | null };
  now?: Date;
};

export type ConsultResult = {
  caseId: string;
  consult: ConsultRow;
  /** Weekly free tier status after this consult (null when unlimited). */
  quota: { remaining: number; limit: number; resetAt: string } | null;
  intensityApplied: Intensity;
  downgraded: boolean;
};

export function parseConsultRequest(body: unknown): ConsultRequest {
  const res = ConsultRequestSchema.safeParse(body);
  if (!res.success) {
    const first = res.error.issues[0];
    throw new ConsultError("bad_request", first?.message ?? "Invalid request.", 400, {
      issues: res.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return res.data;
}

/**
 * One consult, end to end:
 * load the case thread, safety pre-screen (care mode is never blocked by quota),
 * daily cap, guest limits, weekly free tier (402 before any model call), intensity
 * downgrade, generate a validated reply, persist, meter, log safety events.
 */
export async function runConsult(ctx: ConsultContext): Promise<ConsultResult> {
  // Keys consumed on this request, so anything that fails afterwards hands the
  // allowance back instead of charging a guest for a consult they never got.
  const consumed: string[] = [];
  try {
    return await runConsultInner(ctx, consumed);
  } catch (e) {
    await refundGuestQuota(ctx, consumed);
    throw e;
  }
}

/** Refunds anything consumed and empties the list, so it is safe to call twice. */
async function refundGuestQuota(ctx: ConsultContext, consumed: string[]): Promise<void> {
  if (!consumed.length || !ctx.guest) return;
  const keys = consumed.splice(0, consumed.length);
  for (const k of keys) {
    try {
      await ctx.guest.throttle.release(k);
    } catch {
      // Already on a failure path; never mask the original error.
    }
  }
}

/**
 * Phase timings for one consult, emitted as a structured log line at the end.
 * Durations only, never user content. The model turned out to be about a third
 * of the wall clock once its thinking was capped, so the rest needs to be
 * visible as discrete fields (searchable in Vercel log drain).
 */
function timer() {
  const marks: Array<[string, number]> = [];
  let last = Date.now();
  return {
    mark(name: string) {
      const t = Date.now();
      marks.push([name, t - last]);
      last = t;
    },
    /**
     * Emit one structured event with all phase durations as top-level fields
     * plus any extra context fields (persona, action, model, etc.).
     */
    log(total: number, extra: Record<string, unknown> = {}) {
      const phases: Record<string, number> = {};
      for (const [n, ms] of marks) phases[n] = ms;
      log.info("consult.complete", { totalMs: total, ...phases, ...extra });
    },
  };
}

async function runConsultInner(ctx: ConsultContext, consumed: string[]): Promise<ConsultResult> {
  const { store, llm, request, limits } = ctx;
  const now = ctx.now ?? new Date();
  const started = Date.now();
  const t = timer();

  // Every read below is independent and scoped to this user by row level
  // security, so they go out together rather than one after another. The
  // results are still evaluated in the original order, so the error a caller
  // sees for a bad request is unchanged.
  //
  // Not parallelised: the guest throttle consume, which mutates and must come
  // after the checks above it decide the request is allowed, and everything in
  // persist, which depends on the model output.
  const isNew = request.action === "new";
  const needGuestCount = ctx.isGuest && isNew && limits.guestConsults >= 0;
  const needWeekly = ctx.plan === "free" && !ctx.isGuest && limits.freeConsultsPerWeek > 0;

  const [caseRow, historyRows, todayCount, guestCaseCount, weeklyUsed] = await Promise.all([
    isNew ? Promise.resolve(null) : store.getCase(request.caseId),
    isNew ? Promise.resolve([] as ConsultRow[]) : store.listConsults(request.caseId),
    store.countUsage("consult", windowStart(now, "day")),
    needGuestCount ? store.countCases() : Promise.resolve(0),
    needWeekly ? store.countUsage("consult", windowStart(now, "week"), { billableOnly: true }) : Promise.resolve(0),
  ]);
  t.mark("reads");

  let history: ConsultRow[] = [];
  let caseId: string | null = null;
  if (!isNew) {
    if (!caseRow) throw new ConsultError("not_found", "That case doesn't exist, or it isn't yours.", 404);
    caseId = caseRow.id;
    history = historyRows;
  }

  const userText = request.action === "new" ? request.situation : request.action === "followup" ? request.text : "";
  const situation = request.action === "new" ? request.situation : (history.find((c) => c.kind === "initial")?.user_input ?? "");

  // 1. Safety pre-screen. Never blocked by quota, never billed.
  const crisis = detectCrisis(userText) ?? (request.action === "followup" ? null : detectCrisis(situation));
  if (crisis) {
    const reply = careReply(crisis === "abuse" ? "abuse" : "crisis");
    return persist(ctx, { caseId, reply, intensity: "measured", downgraded: false, model: "safety-rules", usage: null, latencyMs: 0, billable: false, safety: crisis, now });
  }

  // 2. Daily hard cap (every plan). Count already fetched above.
  const daily = checkQuota(todayCount, limits.consultDailyCap, now, "day");
  if (!daily.allowed) {
    throw new ConsultError("rate_limited", "Too many requests right now. Give it a minute, or come back tomorrow.", 429, {
      retryAfter: daily.retryAfter,
      resetAt: daily.resetAt,
    });
  }

  // 3. Is this consult billable? A new case always is; follow-ups, another takes and
  //    persona switches are free up to a per-case allowance.
  const extras = history.filter((c) => c.kind !== "initial").length;
  const billable = request.action === "new" || extras >= limits.freeFollowupsPerCase;

  // 4. Guests: one free case (plus its follow-ups), throttled per device and IP.
  if (ctx.isGuest) {
    if (needGuestCount && guestCaseCount >= limits.guestConsults) {
      throw new ConsultError("guest_limit", "Sign in to keep going. Your case is saved.", 403);
    }
    if (request.action !== "new" && billable) {
      throw new ConsultError("guest_limit", "Sign in to keep going. Your case is saved.", 403);
    }
    if (request.action === "new" && ctx.guest) {
      const { throttle, deviceKey, ipKey } = ctx.guest;
      const okDevice = deviceKey ? await throttle.consume(`d:${deviceKey}`, limits.guestPerDevice, 24) : true;
      if (okDevice && deviceKey) consumed.push(`d:${deviceKey}`);
      const okIp = okDevice && ipKey ? await throttle.consume(`i:${ipKey}`, limits.guestPerIp, 24) : okDevice;
      if (okIp && okDevice && ipKey) consumed.push(`i:${ipKey}`);
      if (!okDevice || !okIp) {
        // The device allowance was already spent before the IP check refused
        // the request, so hand it back rather than charging for a 403.
        await refundGuestQuota(ctx, consumed);
        throw new ConsultError("guest_limit", "Sign in to keep going. Guest consults on this device are used up for today.", 403);
      }
    }
  }

  // 5. Weekly free tier. 402 and no model call when it is spent.
  let weekly: ReturnType<typeof checkQuota> | null = null;
  if (needWeekly) {
    weekly = checkQuota(weeklyUsed, limits.freeConsultsPerWeek, now, "week");
    if (billable && !weekly.allowed) {
      throw new ConsultError("quota_exceeded", `That's your ${weekly.limit} free consults this week.`, 402, {
        resetAt: weekly.resetAt,
        limit: weekly.limit,
      });
    }
    if (!billable) weekly = { ...weekly, remaining: Math.max(0, weekly.limit - weekly.used) };
  }

  // 6. Intensity: No mercy drops to Measured on distress; anything drops for a minor.
  const eff = effectiveIntensity(request.intensity, `${situation}\n${userText}`);

  // 7. Generate.
  const turns = buildTurns(request.persona, history, request);
  t.mark("checks");
  const t0 = Date.now();
  const out = await generateReply(llm, { persona: request.persona, intensity: eff.intensity, turns, country: ctx.country });
  const latencyMs = Date.now() - t0;
  t.mark("model");

  const safety: SafetyCategory | null =
    out.reply.mode === "care" ? "crisis" : out.reply.mode === "decline" ? "illegal_request" : null;

  const result = await persist(ctx, {
    caseId,
    reply: out.reply,
    intensity: eff.intensity,
    downgraded: eff.downgraded,
    model: llm.model,
    usage: out.usage,
    latencyMs,
    billable: out.reply.mode === "care" ? false : billable,
    safety,
    now,
  });
  t.mark("persist");
  if (weekly && result.quota === null) {
    const remaining = billable && out.reply.mode !== "care" ? weekly.remaining : Math.max(0, weekly.limit - weekly.used);
    result.quota = { remaining, limit: weekly.limit, resetAt: weekly.resetAt };
  }
  t.log(Date.now() - started, {
    persona: request.persona,
    action: request.action,
    model: llm.model,
    mode: out.reply.mode,
    billable,
    repaired: out.repaired,
    latencyModel: latencyMs,
    tokensIn: out.usage?.inputTokens ?? null,
    tokensOut: out.usage?.outputTokens ?? null,
  });
  return result;
}

async function persist(
  ctx: ConsultContext,
  p: {
    caseId: string | null;
    reply: Reply;
    intensity: Intensity;
    downgraded: boolean;
    model: string;
    usage: Usage | null;
    latencyMs: number;
    billable: boolean;
    safety: SafetyCategory | null;
    now: Date;
  },
): Promise<ConsultResult> {
  const { store, request } = ctx;
  let caseId = p.caseId;

  const userInput = request.action === "new" ? request.situation : request.action === "followup" ? request.text : null;
  const consultFields = {
    persona: request.persona,
    kind: kindForAction(request.action),
    user_input: userInput,
    spoken: "spoken" in request ? Boolean(request.spoken) : false,
    reply: p.reply,
    mode: p.reply.mode,
    intensity: p.intensity,
    model: p.model,
    prompt_version: PROMPT_VERSION,
    latency_ms: p.latencyMs,
    tokens_in: p.usage?.inputTokens ?? null,
    tokens_out: p.usage?.outputTokens ?? null,
    cache_read_tokens: p.usage?.cacheReadTokens ?? null,
  };

  let consult: ConsultRow;
  if (!caseId) {
    const caseFields = {
      persona: request.persona,
      intensity: p.intensity,
      situation: (request as Extract<ConsultRequest, { action: "new" }>).situation,
      title: p.reply.matter,
      intent: p.reply.intent,
      stakes: p.reply.stakes,
    };
    // One transaction, so a failure cannot leave a case with no consult. Null
    // means the database function is not deployed yet; fall back to the two
    // step path so the app works either side of the migration.
    const atomic = await store.createCaseWithConsult(caseFields, consultFields);
    if (atomic) {
      caseId = atomic.caseRow.id;
      consult = atomic.consult;
    } else {
      const c = await store.createCase(caseFields);
      caseId = c.id;
      consult = await store.addConsult(caseId, { ...consultFields, case_id: caseId });
    }
  } else {
    await store.touchCase(caseId);
    consult = await store.addConsult(caseId, { ...consultFields, case_id: caseId });
  }

  // recordUsage and recordSafetyEvent are independent of each other and neither
  // affects the response the caller needs, so run them concurrently.
  await Promise.all([
    store.recordUsage("consult", { action: request.action, persona: request.persona, mode: p.reply.mode, model: p.model }, p.billable),
    p.safety
      ? store
          .recordSafetyEvent({
            category: p.safety,
            action: p.reply.mode === "decline" ? "decline" : "care_mode",
            locale: ctx.country ?? null,
            consult_id: consult.id,
          })
          .catch(() => undefined)
      : Promise.resolve(),
  ]);

  return { caseId, consult, quota: null, intensityApplied: p.intensity, downgraded: p.downgraded };
}
