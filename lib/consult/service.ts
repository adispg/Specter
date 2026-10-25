import type { DataStore, GuestThrottle } from "@/lib/data/store";
import { kindForAction, type ConsultRow, type Plan } from "@/lib/data/types";
import type { Intensity } from "@/lib/personas/config";
import { PROMPT_VERSION } from "@/lib/personas/rules";
import { buildTurns } from "@/lib/personas/prompt";
import { checkQuota, windowStart } from "@/lib/ratelimit";
import { ConsultError, generateReply } from "./engine";
import type { LlmClient, Usage } from "./llm";
import { careReply, detectCrisis, effectiveIntensity, type SafetyCategory } from "./safety";
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

async function runConsultInner(ctx: ConsultContext, consumed: string[]): Promise<ConsultResult> {
  const { store, llm, request, limits } = ctx;
  const now = ctx.now ?? new Date();

  let history: ConsultRow[] = [];
  let caseId: string | null = null;
  if (request.action !== "new") {
    const c = await store.getCase(request.caseId);
    if (!c) throw new ConsultError("not_found", "That case doesn't exist, or it isn't yours.", 404);
    caseId = c.id;
    history = await store.listConsults(c.id);
  }

  const userText = request.action === "new" ? request.situation : request.action === "followup" ? request.text : "";
  const situation = request.action === "new" ? request.situation : (history.find((c) => c.kind === "initial")?.user_input ?? "");

  // 1. Safety pre-screen. Never blocked by quota, never billed.
  const crisis = detectCrisis(userText) ?? (request.action === "followup" ? null : detectCrisis(situation));
  if (crisis) {
    const reply = careReply(crisis === "abuse" ? "abuse" : "crisis");
    return persist(ctx, { caseId, reply, intensity: "measured", downgraded: false, model: "safety-rules", usage: null, latencyMs: 0, billable: false, safety: crisis, now });
  }

  // 2. Daily hard cap (every plan).
  const today = await store.countUsage("consult", windowStart(now, "day"));
  const daily = checkQuota(today, limits.consultDailyCap, now, "day");
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
    if (request.action === "new" && limits.guestConsults >= 0 && (await store.countCases()) >= limits.guestConsults) {
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
  if (ctx.plan === "free" && !ctx.isGuest && limits.freeConsultsPerWeek > 0) {
    const used = await store.countUsage("consult", windowStart(now, "week"), { billableOnly: true });
    weekly = checkQuota(used, limits.freeConsultsPerWeek, now, "week");
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
  const t0 = Date.now();
  const out = await generateReply(llm, { persona: request.persona, intensity: eff.intensity, turns, country: ctx.country });
  const latencyMs = Date.now() - t0;

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
  if (weekly && result.quota === null) {
    const remaining = billable && out.reply.mode !== "care" ? weekly.remaining : Math.max(0, weekly.limit - weekly.used);
    result.quota = { remaining, limit: weekly.limit, resetAt: weekly.resetAt };
  }
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
  if (!caseId) {
    const c = await store.createCase({
      persona: request.persona,
      intensity: p.intensity,
      situation: (request as Extract<ConsultRequest, { action: "new" }>).situation,
      title: p.reply.matter,
      intent: p.reply.intent,
      stakes: p.reply.stakes,
    });
    caseId = c.id;
  } else {
    await store.touchCase(caseId);
  }

  const userInput = request.action === "new" ? request.situation : request.action === "followup" ? request.text : null;
  const consult = await store.addConsult(caseId, {
    case_id: caseId,
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
  });

  await store.recordUsage("consult", { action: request.action, persona: request.persona, mode: p.reply.mode, model: p.model }, p.billable);
  if (p.safety) {
    await store
      .recordSafetyEvent({
        category: p.safety,
        action: p.reply.mode === "decline" ? "decline" : "care_mode",
        locale: ctx.country ?? null,
        consult_id: consult.id,
      })
      .catch(() => undefined);
  }

  return { caseId, consult, quota: null, intensityApplied: p.intensity, downgraded: p.downgraded };
}
