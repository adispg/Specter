import { describe, expect, it } from "vitest";
import { careReply, detectCrisis, detectMinor, effectiveIntensity } from "@/lib/consult/safety";
import { ReplySchema } from "@/lib/consult/schema";
import { runChecks } from "../../harness/checks";

/**
 * The safety pre-screen is the one path that must never depend on the model, so
 * its canned replies are held to the same contract the harness holds generated
 * replies to. A care reply that failed the contract would still render, which
 * is exactly why nothing caught it before.
 */
describe("crisis detection", () => {
  const crisis = [
    "I lost my job today and I keep thinking everyone would be better off without me.",
    "I have been looking at my sleeping pills.",
    "I don't want to live anymore.",
    "I can't go on like this.",
  ];
  for (const t of crisis) {
    it(`routes to care: ${t.slice(0, 40)}`, () => {
      expect(detectCrisis(t)).not.toBeNull();
    });
  }

  it("routes violence at home to care", () => {
    expect(detectCrisis("My husband hit me again last night when I asked about money.")).toBe("abuse");
  });

  it("leaves an ordinary hard situation alone", () => {
    expect(detectCrisis("My manager took credit for my work and I am furious about it.")).toBeNull();
    expect(detectCrisis("I am going to kill this presentation tomorrow.")).toBeNull();
  });

  it("never downgrades below a measured intensity on a tender situation", () => {
    const { intensity } = effectiveIntensity("nomercy", "I was made redundant today and I feel worthless.");
    expect(["measured", "sharp", "nomercy"]).toContain(intensity);
  });

  it("spots a self declared minor", () => {
    expect(detectMinor("I am 15 and my teacher keeps singling me out.")).toBe(true);
  });
});

describe("care replies hold the reply contract", () => {
  for (const category of ["crisis", "self_harm", "abuse"] as const) {
    it(`${category}: validates and passes the deterministic checks`, () => {
      const reply = careReply(category);
      expect(ReplySchema.safeParse(reply).success).toBe(true);
      const failed = runChecks(reply, "closer", "care").filter((c) => !c.pass);
      expect(failed.map((f) => `${f.name}${f.detail ? ` (${f.detail})` : ""}`)).toEqual([]);
    });
  }

  it("carries no pause marks and no persona swagger", () => {
    const r = careReply("crisis");
    const all = [r.line, r.followup, r.read, ...r.play].join(" ");
    expect(all).not.toContain("|");
    expect(all.toLowerCase()).not.toMatch(/leverage|billed|close the deal/);
    expect(r.avoid).toBe("");
  });
});
