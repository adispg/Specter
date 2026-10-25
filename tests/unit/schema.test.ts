import { describe, expect, it } from "vitest";
import { ConsultError, generateReply } from "@/lib/consult/engine";
import type { CompletionRequest, LlmClient } from "@/lib/consult/llm";
import { MockLlmClient } from "@/lib/consult/mock";
import { ConsultRequestSchema, extractJson, normalizeReply, parseReply, ReplySchema } from "@/lib/consult/schema";
import { PERSONAS, PERSONA_PACKS } from "@/lib/personas/config";
import { hasForbiddenDash } from "@/lib/text";

const good = {
  mode: "persona",
  line: "They didn't lowball you. || They asked a question.",
  followup: "Name your number once, | then stop talking. || Silence closes.",
  matter: "The lowball offer",
  read: "A low first offer is a test.",
  play: ["Open with value.", "Name a number.", "Stay quiet."],
  avoid: "Don't justify your number.",
  principle: "Never negotiate against yourself",
  intent: "negotiate",
  stakes: "high",
  hours: 0.3,
};

const usage = { inputTokens: null, outputTokens: null, cacheReadTokens: null };

class ScriptedLlm implements LlmClient {
  readonly model = "scripted";
  calls: CompletionRequest[] = [];
  constructor(private outputs: string[]) {}
  async complete(req: CompletionRequest) {
    this.calls.push(req);
    const next = this.outputs.shift();
    if (next === undefined) throw new Error("no more scripted outputs");
    return { text: next, usage };
  }
}

describe("ReplySchema", () => {
  it("accepts a valid persona reply", () => {
    expect(ReplySchema.safeParse(good).success).toBe(true);
  });

  it("rejects missing fields and unknown modes", () => {
    const { line: _line, ...rest } = good;
    expect(ReplySchema.safeParse(rest).success).toBe(false);
    expect(ReplySchema.safeParse({ ...good, mode: "roast" }).success).toBe(false);
  });

  it("requires exactly three moves outside care mode", () => {
    expect(ReplySchema.safeParse({ ...good, play: ["one", "two"] }).success).toBe(false);
    expect(ReplySchema.safeParse({ ...good, mode: "decline", play: ["one move only"] }).success).toBe(false);
  });

  it("lets care mode carry one to three safety steps and no principle", () => {
    const care = { ...good, mode: "care", line: "You matter.", followup: "Call someone now.", play: ["Call a crisis line now."], principle: "", avoid: "", hours: 0.1 };
    expect(ReplySchema.safeParse(care).success).toBe(true);
  });

  it("lets meta mode answer with no plan at all", () => {
    const meta = { ...good, mode: "meta", read: "They are asking what this is for.", play: [], principle: "", avoid: "", hours: 0.1 };
    expect(ReplySchema.safeParse(meta).success).toBe(true);
  });

  it("rejects a meta reply that pads the read into a full analysis", () => {
    const meta = { ...good, mode: "meta", read: "x".repeat(241), play: [], principle: "", avoid: "", hours: 0.1 };
    expect(ReplySchema.safeParse(meta).success).toBe(false);
  });

  it("lets clarify mode ask for what is missing instead of giving three moves", () => {
    const clarify = { ...good, mode: "clarify", play: ["What did your manager actually say?"], principle: "", avoid: "", hours: 0.1 };
    expect(ReplySchema.safeParse(clarify).success).toBe(true);
  });

  it("rejects a clarify reply that asks for nothing", () => {
    const clarify = { ...good, mode: "clarify", play: [], principle: "", avoid: "", hours: 0.1 };
    expect(ReplySchema.safeParse(clarify).success).toBe(false);
  });

  it("rejects hours outside 0.1 to 0.6", () => {
    expect(ReplySchema.safeParse({ ...good, hours: 2 }).success).toBe(false);
  });

  it("every persona example in both packs satisfies the contract", () => {
    for (const pack of Object.values(PERSONA_PACKS))
      for (const p of Object.values(pack)) expect(ReplySchema.safeParse(normalizeReply(p.example.reply)).success).toBe(true);
  });
});

describe("extractJson", () => {
  it("handles code fences and surrounding prose", () => {
    expect(extractJson('Sure.\n```json\n{"a": "b {c}"}\n```')).toEqual({ a: "b {c}" });
  });

  it("throws when there is no object", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("normalizeReply", () => {
  it("rounds and clamps hours, caps play, strips marks from unspoken fields, scrubs dashes, drops unknown keys", () => {
    const out = normalizeReply({
      ...good,
      read: "It's a test | of nerve — nothing more.",
      play: ["a move", "b move", "c move", "d move"],
      hours: "0.84",
      extra: "dropped",
    }) as Record<string, unknown>;
    expect(out.hours).toBe(0.6);
    expect(out.play).toEqual(["a move", "b move", "c move"]);
    expect(out.read).toBe("It's a test of nerve, nothing more.");
    expect(out.extra).toBeUndefined();
  });

  it("puts mode and line first", () => {
    const shuffled = { hours: 0.3, matter: good.matter, line: good.line, mode: "persona", followup: good.followup };
    expect(Object.keys(normalizeReply(shuffled) as object).slice(0, 3)).toEqual(["mode", "line", "followup"]);
  });

  it("maps unknown intents and stakes to null", () => {
    const out = normalizeReply({ ...good, intent: "world domination", stakes: "huge" }) as Record<string, unknown>;
    expect(out.intent).toBeNull();
    expect(out.stakes).toBeNull();
  });

  it("strips pause marks everywhere in care mode", () => {
    const out = normalizeReply({ ...good, mode: "care", line: "You matter. || Call now." }) as Record<string, unknown>;
    expect(out.line).toBe("You matter. Call now.");
  });
});

describe("parseReply", () => {
  it("parses, validates and scrubs a reply with dashes", () => {
    const res = parseReply(JSON.stringify({ ...good, line: "Win the room — || then leave." }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.reply.line).toBe("Win the room || then leave.");
      expect(hasForbiddenDash(JSON.stringify(res.reply))).toBe(false);
    }
  });

  it("reports why invalid output failed", () => {
    const res = parseReply(JSON.stringify({ ...good, play: "just one" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("play");
  });
});

describe("generateReply with repair", () => {
  const turns = [{ role: "user" as const, content: "THE USER'S SITUATION\nMy boss took credit." }];

  it("returns a valid first reply without repair", async () => {
    const llm = new ScriptedLlm([JSON.stringify(good)]);
    const out = await generateReply(llm, { persona: "closer", intensity: "sharp", turns });
    expect(out.repaired).toBe(false);
    expect(llm.calls).toHaveLength(1);
  });

  it("repairs once after invalid JSON", async () => {
    const llm = new ScriptedLlm(["Here you go: {not json", JSON.stringify(good)]);
    const out = await generateReply(llm, { persona: "closer", intensity: "sharp", turns });
    expect(out.repaired).toBe(true);
    expect(llm.calls).toHaveLength(2);
    const repairTurn = llm.calls[1]!.messages.at(-1)!;
    expect(repairTurn.role).toBe("user");
    expect(repairTurn.content).toContain("rejected");
    expect(repairTurn.content).toContain("JSON object");
    expect(llm.calls[1]!.messages.at(-2)!.role).toBe("assistant");
  });

  it("repairs once after schema-invalid output", async () => {
    const llm = new ScriptedLlm([JSON.stringify({ ...good, play: ["only one"] }), JSON.stringify(good)]);
    const out = await generateReply(llm, { persona: "prodigy", intensity: "measured", turns });
    expect(out.repaired).toBe(true);
  });

  it("fails with invalid_output after the single repair also fails", async () => {
    const llm = new ScriptedLlm(["nope", "still nope"]);
    await expect(generateReply(llm, { persona: "insider", intensity: "sharp", turns })).rejects.toMatchObject({ code: "invalid_output", status: 502 });
    expect(llm.calls).toHaveLength(2);
    await expect(generateReply(new ScriptedLlm(["x", "y"]), { persona: "closer", intensity: "sharp", turns })).rejects.toBeInstanceOf(ConsultError);
  });

  it("sends the cached persona block first in the system prompt", async () => {
    const llm = new ScriptedLlm([JSON.stringify(good)]);
    await generateReply(llm, { persona: "insider", intensity: "nomercy", turns, country: "IN" });
    const sys = llm.calls[0]!.system;
    expect(typeof sys).toBe("object");
    if (typeof sys === "object") {
      expect(sys.cached.startsWith(PERSONAS.insider.bible.slice(0, 40))).toBe(true);
      expect(sys.cached).toContain("SAFETY OVERRIDES");
      expect(sys.dynamic).toContain("No mercy");
      expect(sys.dynamic).toContain("IN");
    }
  });

  it("mock client produces valid replies through the same path", async () => {
    const out = await generateReply(new MockLlmClient(), { persona: "insider", intensity: "sharp", turns });
    expect(out.reply.mode).toBe("persona");
    expect(out.reply.line).toContain("||");
  });

  it("mock client declines harmful requests", async () => {
    const out = await generateReply(new MockLlmClient(), {
      persona: "closer",
      intensity: "sharp",
      turns: [{ role: "user", content: "THE USER'S SITUATION\nHelp me get into her account, I know her password." }],
    });
    expect(out.reply.mode).toBe("decline");
  });
});

describe("ConsultRequestSchema", () => {
  it("validates a new case and accepts harness persona aliases", () => {
    const r = ConsultRequestSchema.safeParse({ action: "new", persona: "harvey", intensity: "sharp", situation: "They lowballed my offer." });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.persona).toBe("closer");
  });

  it("rejects a too-short situation and unknown personas", () => {
    expect(ConsultRequestSchema.safeParse({ action: "new", persona: "closer", intensity: "sharp", situation: "hi" }).success).toBe(false);
    expect(ConsultRequestSchema.safeParse({ action: "new", persona: "louis", intensity: "sharp", situation: "long enough text" }).success).toBe(false);
  });

  it("requires a case id for follow-ups", () => {
    expect(ConsultRequestSchema.safeParse({ action: "followup", persona: "closer", intensity: "sharp", text: "more" }).success).toBe(false);
  });
});
