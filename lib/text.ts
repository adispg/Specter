/**
 * Text hygiene shared by server and client.
 *
 * Founder style rule: no em dashes or en dashes anywhere in user-facing copy or
 * generated output. Hyphens in compound words and numeric ranges are fine.
 */

// U+2013 en dash, U+2014 em dash, U+2015 horizontal bar, U+2012 figure dash, U+2E3A/U+2E3B two/three-em dash
const DASH_CLASS = "\\u2012\\u2013\\u2014\\u2015\\u2E3A\\u2E3B";
const NUMERIC_RANGE = new RegExp(`(\\d)\\s*[${DASH_CLASS}]\\s*(\\d)`, "g");
const SPACED_OR_BARE = new RegExp(`\\s*[${DASH_CLASS}]+\\s*`, "g");
const DASH_BEFORE_MARK = new RegExp(`\\s*[${DASH_CLASS}]+\\s*(?=\\|)`, "g");
const DASH_AFTER_MARK = new RegExp(`(?<=\\|)\\s*[${DASH_CLASS}]+\\s*`, "g");
// A double hyphen typed as a pseudo em dash: "word -- word"
const DOUBLE_HYPHEN = /\s+-{2,}\s+|(?<=\w)-{2,}(?=\w)/g;

/**
 * Replace em/en dashes with punctuation the founder accepts.
 * - Numeric ranges (5, en dash, 10) become hyphenated ("5-10").
 * - Everything else becomes a comma, with tidy spacing.
 * - Never leaves doubled punctuation such as ", ," or ",." behind.
 */
export function scrubDashes(input: string): string {
  if (!input) return input;
  let s = input.replace(NUMERIC_RANGE, "$1-$2");
  // A dash right next to a pause mark is redundant: the mark already carries the pause.
  s = s.replace(DASH_BEFORE_MARK, " ").replace(DASH_AFTER_MARK, " ");
  s = s.replace(DOUBLE_HYPHEN, ", ");
  s = s.replace(SPACED_OR_BARE, ", ");
  // A dash that ended a clause right before other punctuation: "wait, ." -> "wait."
  s = s.replace(/,\s*([.,;:!?])/g, "$1");
  // A dash at the very start: ", Hello" -> "Hello"
  s = s.replace(/^\s*,\s*/, "");
  // A dash at the very end: "Hello, " -> "Hello"
  s = s.replace(/\s*,\s*$/, "");
  return s.replace(/[ \t]{2,}/g, " ");
}

/** Recursively scrub every string in a JSON-like value. */
export function scrubDeep<T>(value: T): T {
  if (typeof value === "string") return scrubDashes(value) as T;
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = scrubDeep(v);
    return out as T;
  }
  return value;
}

export function hasForbiddenDash(s: string): boolean {
  return new RegExp(`[${DASH_CLASS}]`).test(s);
}

/** Collapse whitespace and trim. */
export function squish(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function wordCount(s: string): number {
  const t = squish(s.replace(/\|+/g, " "));
  return t ? t.split(" ").length : 0;
}

const DOUBLE_FINAL = new Set(["regret", "forget", "admit", "commit", "omit", "submit", "permit", "refer", "prefer", "occur", "upset", "begin", "overstep"]);

/** "justify" -> "justifying", "vent" -> "venting", "let" -> "letting", "make" -> "making". */
export function toGerund(verb: string): string {
  const v = verb.toLowerCase();
  if (v === "be") return "being";
  if (v === "see") return "seeing";
  if (v.endsWith("ie")) return `${v.slice(0, -2)}ying`;
  if (v.endsWith("ee") || v.endsWith("ye") || v.endsWith("oe")) return `${v}ing`;
  if (v.endsWith("e") && v.length > 2) return `${v.slice(0, -1)}ing`;
  const cvc = /^[^aeiou]*[aeiou][^aeiouwxy]$/.test(v);
  if ((cvc && v.length <= 4) || DOUBLE_FINAL.has(v)) return `${v}${v.slice(-1)}ing`;
  return `${v}ing`;
}

/**
 * The avoid card's label already says "Don't", so the sentence must start with the
 * mistake itself (persona-specs.md): "Don't justify your number" -> "Justifying your number".
 */
export function rewriteAvoid(s: string): string {
  const m = s.match(/^\s*(?:don['’]t|do\s+not|never)\s+([A-Za-z]+)\b/i);
  if (!m) return s;
  const g = toGerund(m[1]!);
  const rest = s.slice(m[0].length);
  return `${g.charAt(0).toUpperCase()}${g.slice(1)}${rest}`;
}
