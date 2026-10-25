import { describe, expect, it } from "vitest";
import { breakTag, countMarks, marksToBreaks, parseSpoken, splitMarks, stripMarks, toElevenLabsText } from "@/lib/spoken";
import { estimateTimeline, progressAt, timelineFromAlignment } from "@/lib/timings";
import { pauseLengthsFor } from "@/lib/tts/speech";

const HARVEY = { short: 0.45, long: 1.1 };

describe("splitMarks", () => {
  it("splits text on beats and long pauses", () => {
    expect(splitMarks("They didn't lowball you. || They asked a question. | Tomorrow, you answer it.")).toEqual([
      { kind: "text", text: "They didn't lowball you." },
      { kind: "pause", len: "long" },
      { kind: "text", text: "They asked a question." },
      { kind: "pause", len: "short" },
      { kind: "text", text: "Tomorrow, you answer it." },
    ]);
  });

  it("handles marks without spaces and runs of pipes", () => {
    expect(splitMarks("one|two|||three")).toEqual([
      { kind: "text", text: "one" },
      { kind: "pause", len: "short" },
      { kind: "text", text: "two" },
      { kind: "pause", len: "long" },
      { kind: "text", text: "three" },
    ]);
  });

  it("merges adjacent marks into the longest one", () => {
    expect(splitMarks("a | || b")).toEqual([
      { kind: "text", text: "a" },
      { kind: "pause", len: "long" },
      { kind: "text", text: "b" },
    ]);
  });

  it("drops a leading mark", () => {
    expect(splitMarks("|| Hello there")).toEqual([{ kind: "text", text: "Hello there" }]);
  });

  it("returns nothing for empty input", () => {
    expect(splitMarks("")).toEqual([]);
  });
});

describe("parseSpoken", () => {
  it("assigns global word and pause indexes across line and follow-up", () => {
    const s = parseSpoken("Fold. || Then win.", "Say less. | Mean it.");
    expect(s.wordCount).toBe(7);
    const words = [...s.line, ...s.followup].filter((t) => t.type === "word").map((t) => (t.type === "word" ? t.wordIndex : -1));
    expect(words).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(s.segments.map((g) => g.text)).toEqual(["Fold.", "Then win.", "Say less.", "Mean it."]);
    expect(s.segments.map((g) => g.pause?.len ?? null)).toEqual(["long", "long", "short", null]);
  });

  it("adds a hidden long pause between line and follow-up when the line has none", () => {
    const s = parseSpoken("Fold.", "Then win.");
    const hidden = s.line.find((t) => t.type === "pause");
    expect(hidden).toMatchObject({ type: "pause", len: "long", hidden: true });
    expect(s.segments[0]!.pause?.len).toBe("long");
  });

  it("keeps a trailing mark drawn but does not time it", () => {
    const s = parseSpoken("Hold the line. ||");
    expect(s.line.filter((t) => t.type === "pause")).toHaveLength(1);
    expect(s.segments[0]!.pause).toBeNull();
  });

  it("scrubs dashes inside spoken text", () => {
    const s = parseSpoken("Win — then leave.");
    expect(s.segments[0]!.text).toBe("Win, then leave.");
  });
});

describe("helpers", () => {
  it("stripMarks produces plain text", () => {
    expect(stripMarks("Name it once, | then stop. || Silence wins.")).toBe("Name it once, then stop. Silence wins.");
  });

  it("countMarks counts each kind", () => {
    expect(countMarks("a | b || c | d")).toEqual({ short: 2, long: 1 });
  });
});

describe("break conversion", () => {
  it("formats break tags", () => {
    expect(breakTag("short", HARVEY)).toBe('<break time="0.45s" />');
    expect(breakTag("long", HARVEY)).toBe('<break time="1.1s" />');
  });

  it("converts pause marks to ElevenLabs break tags", () => {
    expect(marksToBreaks("They didn't lowball you. || They asked a question. | Tomorrow, you answer it.", HARVEY)).toBe(
      'They didn\'t lowball you. <break time="1.1s" /> They asked a question. <break time="0.45s" /> Tomorrow, you answer it.',
    );
  });

  it("joins line and follow-up with a long break and records word offsets", () => {
    const script = parseSpoken("Fold.", "Then win.");
    const { text, wordOffsets, words } = toElevenLabsText(script, HARVEY);
    expect(text).toBe('Fold. <break time="1.1s" /> Then win.');
    expect(words).toEqual(["Fold.", "Then", "win."]);
    for (const [i, off] of wordOffsets.entries()) expect(text.slice(off, off + words[i]!.length)).toBe(words[i]);
  });

  it("clamps break lengths to ElevenLabs' 3 second maximum", () => {
    expect(breakTag("long", { short: 0.4, long: 9 })).toBe('<break time="3s" />');
  });

  it("uses per-persona lengths and scales them with pace", () => {
    expect(pauseLengthsFor("closer")).toEqual({ short: 0.42, long: 1.05 });
    expect(pauseLengthsFor("prodigy")).toEqual({ short: 0.3, long: 0.7 });
    const fast = pauseLengthsFor("closer", 1.2);
    expect(fast.long).toBeLessThan(1.05);
  });
});

describe("timelines", () => {
  it("estimates a monotonic timeline with timed pauses", () => {
    const script = parseSpoken("They didn't lowball you. || They asked.");
    const tl = estimateTimeline(script, HARVEY);
    const starts = tl.entries.map((e) => e.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    const pause = tl.entries.find((e) => e.type === "pause")!;
    expect(pause.end - pause.start).toBeCloseTo(1.1, 2);
    expect(tl.duration).toBeGreaterThan(pause.end);
  });

  it("maps character alignment to words even with break tags present", () => {
    const script = parseSpoken("Go now. | Win.");
    const { text, words } = toElevenLabsText(script, HARVEY);
    const chars = [...text];
    const alignment = {
      characters: chars,
      character_start_times_seconds: chars.map((_, i) => i * 0.05),
      character_end_times_seconds: chars.map((_, i) => i * 0.05 + 0.05),
    };
    const tl = timelineFromAlignment(script, words, alignment, HARVEY);
    expect(tl.matched).toBe(3);
    const w = tl.entries.filter((e) => e.type === "word");
    expect(w[0]!.start).toBe(0);
    expect(w[2]!.start).toBeCloseTo(text.indexOf("Win.") * 0.05, 3);
    const pause = tl.entries.find((e) => e.type === "pause")!;
    expect(pause.start).toBeCloseTo(w[1]!.end, 3);
    expect(pause.end).toBeCloseTo(w[2]!.start, 3);
  });

  it("interpolates words the alignment does not contain", () => {
    const script = parseSpoken("I have 3 offers.");
    const alignment = {
      characters: [..."I have three offers."],
      character_start_times_seconds: [..."I have three offers."].map((_, i) => i * 0.1),
      character_end_times_seconds: [..."I have three offers."].map((_, i) => i * 0.1 + 0.1),
    };
    const tl = timelineFromAlignment(script, ["I", "have", "3", "offers."], alignment, HARVEY);
    const w = tl.entries.filter((e) => e.type === "word");
    expect(w).toHaveLength(4);
    expect(w[2]!.start).toBeGreaterThanOrEqual(w[1]!.end);
    expect(w[2]!.end).toBeLessThanOrEqual(w[3]!.start);
  });

  it("reports progress at a time", () => {
    const tl = {
      duration: 3,
      entries: [
        { type: "word" as const, index: 0, start: 0, end: 0.5 },
        { type: "pause" as const, index: 0, start: 0.5, end: 1.5 },
        { type: "word" as const, index: 1, start: 1.5, end: 2 },
      ],
    };
    expect(progressAt(tl, 0.2)).toEqual({ wordsLit: 1, activePause: null });
    expect(progressAt(tl, 1)).toEqual({ wordsLit: 1, activePause: 0 });
    expect(progressAt(tl, 1.6)).toEqual({ wordsLit: 2, activePause: null });
  });
});
