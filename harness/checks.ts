/**
 * Deterministic checks from harness/rubric.md section 1. Fast, binary, run
 * before any judge. Any failure is a hard fail for that case.
 *
 * These encode the contract, not taste. They are the part that can run in CI
 * with no API key, which is why they are kept free of model calls.
 */
import { PERSONAS, type PersonaId } from "@/lib/personas/config";
import type { Mode, Reply } from "@/lib/consult/schema";
import { hasForbiddenDash, wordCount } from "@/lib/text";

export type CheckResult = { name: string; pass: boolean; detail?: string };

/** Fields that may carry pause marks. Everything else must be clean. */
const SPOKEN_FIELDS = ["line", "followup"] as const;

const HEDGES = ["maybe", "perhaps", "i think", "sort of", "kind of"];

/** Rubric: no emojis, hashtags or markdown anywhere. */
const EMOJI = /\p{Extended_Pictographic}/u;
const HASHTAG = /(^|\s)#\w/;
const MARKDOWN = /(\*\*|__|^\s*[-*]\s+|^\s*#{1,6}\s|\[[^\]]+\]\([^)]+\)|`)/m;

/** Strip pause marks so word and sentence counts measure the spoken words. */
export function stripMarks(s: string): string {
  return s.replace(/\|+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Sentence count. Abbreviations are rare in this copy and a decimal such as
 * 0.3 is not followed by a space, so a terminator plus whitespace or end of
 * string is accurate enough for a binary check.
 */
export function sentenceCount(s: string): number {
  const t = stripMarks(s);
  if (!t) return 0;
  return t.split(/[.!?]+(?:\s+|$)/).filter((x) => x.trim().length > 0).length;
}

/** Total silence in milliseconds, using the persona's own gap timings. */
export function silenceMs(s: string, persona: PersonaId): number {
  const { gaps } = PERSONAS[persona].voice;
  const longs = (s.match(/\|\|/g) ?? []).length;
  const shorts = (s.replace(/\|\|/g, "").match(/\|/g) ?? []).length;
  return longs * gaps.long + shorts * gaps.short;
}

/** Every string in the reply, for the checks that apply to all of them. */
function allStrings(r: Reply): Array<{ field: string; value: string }> {
  const out: Array<{ field: string; value: string }> = [];
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === "string") out.push({ field: k, value: v });
    else if (Array.isArray(v)) v.forEach((x, i) => typeof x === "string" && out.push({ field: `${k}[${i}]`, value: x }));
  }
  return out;
}

/**
 * How many moves "play" must hold, per mode. persona and decline owe a full
 * plan; clarify asks one to three questions; meta may answer with none.
 */
function playRange(mode: Mode): { min: number; max: number } {
  if (mode === "persona" || mode === "decline") return { min: 3, max: 3 };
  if (mode === "meta") return { min: 0, max: 3 };
  return { min: 1, max: 3 };
}

/** Modes that carry no plan, so principle and avoid may be empty. */
function isLight(mode: Mode): boolean {
  return mode === "care" || mode === "meta" || mode === "clarify";
}

export function runChecks(reply: Reply, persona: PersonaId, expectedMode: Mode): CheckResult[] {
  const out: CheckResult[] = [];
  const add = (name: string, pass: boolean, detail?: string) => out.push(detail && !pass ? { name, pass, detail } : { name, pass });

  // Mode
  add("mode", reply.mode === expectedMode, `expected ${expectedMode}, got ${reply.mode}`);

  // Dashes, emojis, hashtags, markdown across every string
  const strings = allStrings(reply);
  const dashed = strings.filter((s) => hasForbiddenDash(s.value));
  add("dashes", dashed.length === 0, dashed.map((d) => d.field).join(", "));

  const emoji = strings.filter((s) => EMOJI.test(s.value));
  add("no emoji", emoji.length === 0, emoji.map((d) => d.field).join(", "));

  const tagged = strings.filter((s) => HASHTAG.test(s.value));
  add("no hashtags", tagged.length === 0, tagged.map((d) => d.field).join(", "));

  const md = strings.filter((s) => MARKDOWN.test(s.value));
  add("no markdown", md.length === 0, md.map((d) => d.field).join(", "));

  // Line length
  const lineWords = wordCount(stripMarks(reply.line));
  add("line at most 24 words", lineWords <= 24, `${lineWords} words`);

  // Followup sentences. The rubric says exactly two; the lighter modes may
  // legitimately answer in one, so they are allowed one or two.
  const fus = sentenceCount(reply.followup);
  if (reply.mode === "persona" || reply.mode === "decline") {
    add("followup exactly two sentences", fus === 2, `${fus} sentences`);
  } else {
    add("followup one or two sentences", fus >= 1 && fus <= 2, `${fus} sentences`);
  }

  // Play
  const { min, max } = playRange(reply.mode);
  add("play count", reply.play.length >= min && reply.play.length <= max, `${reply.play.length} items, expected ${min} to ${max}`);
  const longPlay = reply.play.filter((m) => wordCount(m) > 30);
  add("play items at most 30 words", longPlay.length === 0, `${longPlay.length} over`);
  const multiPlay = reply.play.filter((m) => sentenceCount(m) > 1);
  add("play items one sentence", multiPlay.length === 0, `${multiPlay.length} over`);

  // Read and avoid
  const readS = sentenceCount(reply.read);
  add("read at most two sentences", readS <= 2, `${readS} sentences`);
  if (reply.avoid) {
    const avoidS = sentenceCount(reply.avoid);
    add("avoid one sentence", avoidS === 1, `${avoidS} sentences`);
  }

  // Principle and avoid are required for the full advice modes only
  if (!isLight(reply.mode)) {
    add("principle present", reply.principle.trim().length >= 2);
    add("avoid present", reply.avoid.trim().length >= 3);
  }

  // Pause marks: only in line and followup
  const strayMarks = strings.filter((s) => !SPOKEN_FIELDS.some((f) => s.field === f) && s.value.includes("|"));
  add("marks only in line and followup", strayMarks.length === 0, strayMarks.map((d) => d.field).join(", "));

  // Care mode carries no marks at all
  if (reply.mode === "care") {
    const anyMark = strings.some((s) => s.value.includes("|"));
    add("care mode has no marks", !anyMark);
  } else {
    // Mark placement inside the spoken fields
    for (const f of SPOKEN_FIELDS) {
      const v = reply[f];
      if (!v.includes("|")) continue;
      const trimmed = v.trim();
      add(`${f} marks not at edges`, !/^\|/.test(trimmed) && !/\|$/.test(trimmed));
      // Spaced on both sides, and no run longer than two
      add(`${f} marks spaced`, !/\S\|/.test(v) && !/\|\S/.test(v));
      add(`${f} no mark runs over two`, !/\|{3,}/.test(v));
      // Adjacent marks separated only by spaces, for example "| |"
      add(`${f} no adjacent marks`, !/\|\s+\|/.test(v.replace(/\|\|/g, "L")));
    }

    // Persona minimums on the line, from the rubric
    const longs = (reply.line.match(/\|\|/g) ?? []).length;
    if (reply.mode === "persona") {
      if (persona === "closer") add("closer line has a long pause", longs >= 1, `${longs}`);
      if (persona === "prodigy") add("prodigy line has exactly one long pause", longs === 1, `${longs}`);
      if (persona === "insider") add("insider line has a long pause", longs >= 1, `${longs}`);
    }
  }

  // Silence budget
  const lineMs = silenceMs(reply.line, persona);
  add("line silence at most 2.5s", lineMs <= 2500, `${lineMs}ms`);
  const fuMs = silenceMs(reply.followup, persona);
  add("followup silence at most 3s", fuMs <= 3000, `${fuMs}ms`);

  // Hedges, closer only
  if (persona === "closer") {
    const hay = `${reply.line} ${reply.followup}`.toLowerCase();
    const found = HEDGES.filter((h) => hay.includes(h));
    add("closer avoids hedges", found.length === 0, found.join(", "));
  }

  return out;
}

/** Word overlap between two lines, for the "another line" rule. */
export function wordOverlap(a: string, b: string): number {
  const norm = (s: string) =>
    new Set(
      stripMarks(s)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter(Boolean),
    );
  const sa = norm(a);
  const sb = norm(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const w of sa) if (sb.has(w)) shared += 1;
  return shared / Math.min(sa.size, sb.size);
}
