import { beforeEach, describe, expect, it } from "vitest";
import { MockLlmClient } from "@/lib/consult/mock";
import { DEFAULT_LIMITS, runConsult, type ConsultContext } from "@/lib/consult/service";
import { MemoryGuestThrottle, MemoryStore, resetMemoryDb } from "@/lib/data/memory";
import { checkQuota, quotaHeaders, startOfUtcDay, startOfUtcWeek, windowEnd } from "@/lib/ratelimit";

describe("checkQuota", () => {
  const now = new Date("2026-10-25T18:30:00Z"); // a Sunday

  it("allows under the limit and reports remaining after this call", () => {
    expect(checkQuota(3, 5, now)).toMatchObject({ allowed: true, used: 3, remaining: 1, limit: 5 });
  });

  it("blocks at the limit with a retry-after until the next UTC midnight", () => {
    const q = checkQuota(5, 5, now, "day");
    expect(q.allowed).toBe(false);
    expect(q.resetAt).toBe("2026-10-26T00:00:00.000Z");
    expect(q.retryAfter).toBe(5.5 * 3600);
  });

  it("uses Monday 00:00 UTC weeks", () => {
    expect(startOfUtcWeek(now).toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(windowEnd(now, "week").toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(startOfUtcWeek(new Date("2026-10-26T00:00:01Z")).toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("treats a limit of 0 as unlimited and sanitises bad counts", () => {
    expect(checkQuota(10_000, 0, now).allowed).toBe(true);
    expect(checkQuota(Number.NaN, 2, now)).toMatchObject({ allowed: true, used: 0 });
  });

  it("computes day boundaries and headers", () => {
    expect(startOfUtcDay(now).toISOString()).toBe("2026-10-25T00:00:00.000Z");
    const h = quotaHeaders(checkQuota(5, 5, now));
    expect(h["Retry-After"]).toBe(String(5.5 * 3600));
    expect(h["X-RateLimit-Remaining"]).toBe("0");
  });
});

describe("runConsult quotas and safety", () => {
  beforeEach(() => resetMemoryDb());
  const llm = new MockLlmClient();
  const fresh = { action: "new" as const, persona: "closer" as const, intensity: "sharp" as const, situation: "They lowballed my offer." };
  const ctx = (over: Partial<ConsultContext>): ConsultContext => ({
    store: new MemoryStore("user-a"),
    llm,
    request: fresh,
    plan: "free",
    isGuest: false,
    limits: { ...DEFAULT_LIMITS, freeConsultsPerWeek: 2 },
    ...over,
  });

  it("enforces the weekly free tier with 402 and no model call", async () => {
    const store = new MemoryStore("user-a");
    const r1 = await runConsult(ctx({ store }));
    expect(r1.quota).toMatchObject({ remaining: 1, limit: 2 });
    await runConsult(ctx({ store }));
    let calls = 0;
    const counting = { model: "count", complete: async () => ((calls += 1), { text: "{}", usage: r1.consult as never }) };
    await expect(runConsult(ctx({ store, llm: counting }))).rejects.toMatchObject({ code: "quota_exceeded", status: 402 });
    expect(calls).toBe(0);
    // Pro is not limited weekly.
    await expect(runConsult(ctx({ store, plan: "pro" }))).resolves.toBeTruthy();
    // Next week resets.
    await expect(runConsult(ctx({ store, now: new Date(Date.now() + 8 * 86400_000) }))).resolves.toBeTruthy();
  });

  it("lets follow-ups on a case through for free up to the per-case allowance", async () => {
    const store = new MemoryStore("user-b");
    const limits = { ...DEFAULT_LIMITS, freeConsultsPerWeek: 1, freeFollowupsPerCase: 2 };
    const first = await runConsult(ctx({ store, limits }));
    const follow = { action: "followup" as const, caseId: first.caseId, persona: "closer" as const, intensity: "sharp" as const, text: "They came back at 20." };
    await runConsult(ctx({ store, limits, request: follow }));
    await runConsult(ctx({ store, limits, request: { ...follow, action: "another" } as never }));
    await expect(runConsult(ctx({ store, limits, request: follow }))).rejects.toMatchObject({ code: "quota_exceeded" });
  });

  it("enforces the daily hard cap with 429", async () => {
    const store = new MemoryStore("user-c");
    const limits = { ...DEFAULT_LIMITS, freeConsultsPerWeek: 0, consultDailyCap: 1 };
    await runConsult(ctx({ store, limits }));
    await expect(runConsult(ctx({ store, limits }))).rejects.toMatchObject({ code: "rate_limited", status: 429 });
  });

  it("never blocks or bills care mode, even when the quota is spent", async () => {
    const store = new MemoryStore("user-d");
    const limits = { ...DEFAULT_LIMITS, freeConsultsPerWeek: 1 };
    await runConsult(ctx({ store, limits }));
    const r = await runConsult(
      ctx({ store, limits, request: { ...fresh, situation: "I lost my job and everyone would be better off without me." } }),
    );
    expect(r.consult.mode).toBe("care");
    expect(r.consult.reply.line).not.toContain("|");
    expect(await store.countUsage("consult", new Date(0), { billableOnly: true })).toBe(1);
  });

  it("downgrades No mercy to Measured on distress", async () => {
    const r = await runConsult(
      ctx({ request: { ...fresh, intensity: "nomercy", situation: "My father was diagnosed with Parkinson's and my sister and I disagree." } }),
    );
    expect(r.intensityApplied).toBe("measured");
    expect(r.downgraded).toBe(true);
  });

  it("gives guests one case, then asks them to sign in", async () => {
    const store = new MemoryStore("guest-1");
    const guest = { throttle: new MemoryGuestThrottle(), deviceKey: "dev-1", ipKey: "ip-1" };
    const first = await runConsult(ctx({ store, isGuest: true, guest }));
    await runConsult(
      ctx({ store, isGuest: true, guest, request: { action: "followup", caseId: first.caseId, persona: "closer", intensity: "sharp", text: "More detail here." } }),
    );
    await expect(runConsult(ctx({ store, isGuest: true, guest }))).rejects.toMatchObject({ code: "guest_limit", status: 403 });
    // A fresh guest on the same device is throttled too.
    await expect(runConsult(ctx({ store: new MemoryStore("guest-2"), isGuest: true, guest }))).rejects.toMatchObject({ code: "guest_limit" });
  });

  it("switching persona keeps the case and hides the other persona's advice", async () => {
    const store = new MemoryStore("user-e");
    const seen: string[] = [];
    const spy = {
      model: "spy",
      complete: async (req: Parameters<MockLlmClient["complete"]>[0]) => {
        seen.push(req.messages.map((m) => m.content).join("\n---\n"));
        return llm.complete(req);
      },
    };
    const first = await runConsult(ctx({ store, llm: spy }));
    await runConsult(
      ctx({ store, llm: spy, request: { action: "followup", caseId: first.caseId, persona: "closer", intensity: "sharp", text: "They said 20 is final." } }),
    );
    const sw = await runConsult(ctx({ store, llm: spy, request: { action: "switch", caseId: first.caseId, persona: "insider", intensity: "sharp" } }));
    expect(sw.caseId).toBe(first.caseId);
    const insiderPrompt = seen.at(-1)!;
    expect(insiderPrompt).toContain("They lowballed my offer.");
    expect(insiderPrompt).toContain("They said 20 is final.");
    expect(insiderPrompt).not.toContain(first.consult.reply.line);
    const consults = await store.listConsults(first.caseId);
    expect(consults.map((c) => [c.persona, c.kind])).toEqual([
      ["closer", "initial"],
      ["closer", "followup"],
      ["insider", "switch"],
    ]);
  });
});
