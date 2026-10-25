import { describe, expect, it } from "vitest";
import { hasForbiddenDash, scrubDashes, scrubDeep, wordCount } from "@/lib/text";

const EM = "—";
const EN = "–";

describe("scrubDashes", () => {
  it("replaces spaced em dashes with commas", () => {
    expect(scrubDashes(`Win the room ${EM} then leave.`)).toBe("Win the room, then leave.");
  });

  it("replaces unspaced em dashes", () => {
    expect(scrubDashes(`Win the room${EM}then leave.`)).toBe("Win the room, then leave.");
  });

  it("replaces en dashes used as clause breaks", () => {
    expect(scrubDashes(`Say it once ${EN} never twice.`)).toBe("Say it once, never twice.");
  });

  it("keeps numeric ranges as hyphenated ranges", () => {
    expect(scrubDashes(`Give it 5${EN}10 minutes, 2024 ${EN} 2026.`)).toBe("Give it 5-10 minutes, 2024-2026.");
  });

  it("leaves hyphens in compound words alone", () => {
    expect(scrubDashes("A well-known, high-stakes, follow-up call.")).toBe("A well-known, high-stakes, follow-up call.");
  });

  it("converts a double hyphen used as a dash", () => {
    expect(scrubDashes("Wait -- then strike.")).toBe("Wait, then strike.");
  });

  it("does not leave doubled punctuation", () => {
    expect(scrubDashes(`They know ${EM}.`)).toBe("They know.");
    expect(scrubDashes(`${EM} Start here`)).toBe("Start here");
    expect(scrubDashes(`End here ${EM}`)).toBe("End here");
    expect(scrubDashes(`Wait ${EM}, no.`)).toBe("Wait, no.");
  });

  it("keeps pause marks clean around a scrubbed dash", () => {
    expect(scrubDashes(`Silence ${EM} || then the number.`)).toBe("Silence || then the number.");
  });

  it("handles the horizontal bar and figure dash too", () => {
    expect(hasForbiddenDash(scrubDashes("a ― b ‒ c"))).toBe(false);
  });

  it("is idempotent", () => {
    const once = scrubDashes(`One ${EM} two ${EN} three`);
    expect(scrubDashes(once)).toBe(once);
  });
});

describe("scrubDeep", () => {
  it("scrubs every string in nested objects and arrays", () => {
    const out = scrubDeep({ a: `x ${EM} y`, b: [`p ${EN} q`, 3], c: { d: `m${EM}n` }, e: true });
    expect(out).toEqual({ a: "x, y", b: ["p, q", 3], c: { d: "m, n" }, e: true });
    expect(hasForbiddenDash(JSON.stringify(out))).toBe(false);
  });
});

describe("wordCount", () => {
  it("ignores pause marks", () => {
    expect(wordCount("They didn't lowball you. || They asked a question.")).toBe(8);
  });
});
