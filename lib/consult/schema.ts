import { z } from "zod";
import { INTENSITIES, PERSONA_ALIASES, PERSONA_IDS, type PersonaId } from "@/lib/personas/config";
import { INTENT_KEYS } from "@/lib/personas/rules";
import { scrubDeep, squish, wordCount } from "@/lib/text";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const MODES = ["persona", "care", "decline"] as const;
export type Mode = (typeof MODES)[number];

/**
 * The reply contract (PRD.md section 7). Keys are emitted with mode and line first
 * so speech can start before the rest arrives. Server-side limits are a little
 * looser than the harness's deterministic checks so a slightly long line is not a
 * failed consult; the harness holds the stricter rubric.
 */
export const ReplySchema = z
  .object({
    mode: z.enum(MODES),
    line: text(3, 300).refine((s) => wordCount(s) <= 40, "line must be at most 40 words"),
    followup: text(0, 600),
    matter: text(2, 80),
    read: text(3, 600),
    play: z.array(text(3, 400)).min(1).max(3),
    avoid: text(0, 320),
    principle: z.string().trim().max(90),
    intent: z.enum(INTENT_KEYS).nullable(),
    stakes: z.enum(["low", "medium", "high"]).nullable(),
    hours: z.number().min(0.1).max(0.6),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (r.mode !== "care") {
      if (r.play.length !== 3) ctx.addIssue({ code: "custom", path: ["play"], message: "play must have exactly three moves" });
      if (r.principle.length < 2) ctx.addIssue({ code: "custom", path: ["principle"], message: "principle is required" });
      if (r.avoid.length < 3) ctx.addIssue({ code: "custom", path: ["avoid"], message: "avoid is required" });
    }
  });

export type Reply = z.infer<typeof ReplySchema>;

/** Accept slot ids or harness aliases (harvey, mike, donna) on the wire. */
export const PersonaIdSchema = z.preprocess(
  (v) => (typeof v === "string" && PERSONA_ALIASES[v.toLowerCase()] ? PERSONA_ALIASES[v.toLowerCase()] : v),
  z.enum(PERSONA_IDS),
) as unknown as z.ZodType<PersonaId>;
export const IntensitySchema = z.enum(INTENSITIES);

const situation = z.string().trim().min(8, "Give them a little more than that.").max(4000, "That's a novel, not a brief. Cut it down.");

export const ConsultRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("new"), persona: PersonaIdSchema, intensity: IntensitySchema, situation, spoken: z.boolean().optional() }),
  z.object({
    action: z.literal("followup"),
    caseId: z.string().min(1),
    persona: PersonaIdSchema,
    intensity: IntensitySchema,
    text: z.string().trim().min(2).max(1500),
    spoken: z.boolean().optional(),
  }),
  z.object({ action: z.literal("another"), caseId: z.string().min(1), persona: PersonaIdSchema, intensity: IntensitySchema }),
  z.object({ action: z.literal("switch"), caseId: z.string().min(1), persona: PersonaIdSchema, intensity: IntensitySchema }),
]);

export type ConsultRequest = z.infer<typeof ConsultRequestSchema>;
export type ConsultAction = ConsultRequest["action"];

/** Pull the first JSON object out of a model reply: tolerates code fences and stray prose. */
export function extractJson(raw: string): unknown {
  const s = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = s.indexOf("{");
  if (start < 0) throw new Error("no JSON object found");
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return JSON.parse(s.slice(start, i + 1));
    }
  }
  throw new Error("unterminated JSON object");
}

const KEY_ORDER = ["mode", "line", "followup", "matter", "read", "play", "avoid", "principle", "intent", "stakes", "hours"] as const;

/**
 * Lenient clean-up before strict validation: trims and collapses whitespace,
 * rounds and clamps hours, caps play at three, strips pause marks from fields that
 * are not spoken (and from everything in care mode), maps unknown intents to null,
 * drops unknown keys, reorders keys to the contract and removes em/en dashes.
 * Anything still wrong fails validation and triggers the repair retry.
 */
export function normalizeReply(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const r = { ...(input as Record<string, unknown>) };
  // Legacy shape: {care: true}
  if (r.mode === undefined && typeof r.care === "boolean") r.mode = r.care ? "care" : "persona";
  if (typeof r.mode === "string") r.mode = r.mode.trim().toLowerCase();
  const care = r.mode === "care";
  const unmark = (v: unknown) => (typeof v === "string" ? squish(v.replace(/\s*\|+\s*/g, " ")) : v);
  const tidy = (v: unknown) => (typeof v === "string" ? squish(v) : v);
  for (const k of ["matter", "principle", "read", "avoid"]) r[k] = unmark(r[k]);
  for (const k of ["line", "followup"]) r[k] = care ? unmark(r[k]) : tidy(r[k]);
  if (r.followup === undefined || r.followup === null) r.followup = "";
  if (r.principle === undefined || r.principle === null) r.principle = "";
  if (r.avoid === undefined || r.avoid === null) r.avoid = care ? "" : r.avoid;
  if (Array.isArray(r.play)) r.play = r.play.map(unmark).filter((x) => typeof x === "string" && x.length > 0).slice(0, 3);
  if (typeof r.hours === "string") r.hours = Number(r.hours);
  if (care && (typeof r.hours !== "number" || !Number.isFinite(r.hours))) r.hours = 0.1;
  if (typeof r.hours === "number" && Number.isFinite(r.hours)) r.hours = Math.min(0.6, Math.max(0.1, Math.round(r.hours * 10) / 10));
  if (typeof r.intent === "string") {
    const k = r.intent.trim().toLowerCase().replace(/[\s-]+/g, "_");
    r.intent = (INTENT_KEYS as readonly string[]).includes(k) ? k : null;
  } else r.intent = null;
  if (typeof r.stakes === "string") {
    const s = r.stakes.trim().toLowerCase();
    r.stakes = ["low", "medium", "high"].includes(s) ? s : null;
  } else r.stakes = null;
  const ordered: Record<string, unknown> = {};
  for (const k of KEY_ORDER) if (k in r) ordered[k] = r[k];
  return scrubDeep(ordered);
}

export type ParseResult = { ok: true; reply: Reply } | { ok: false; error: string };

export function parseReply(raw: string): ParseResult {
  let obj: unknown;
  try {
    obj = extractJson(raw);
  } catch (e) {
    return { ok: false, error: `Not valid JSON: ${(e as Error).message}` };
  }
  const res = ReplySchema.safeParse(normalizeReply(obj));
  if (!res.success) {
    return { ok: false, error: res.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ") };
  }
  return { ok: true, reply: res.data };
}
