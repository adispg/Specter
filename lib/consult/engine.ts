import type { Intensity, PersonaId } from "@/lib/personas/config";
import { buildSystemPrompt, type ChatTurn, type SystemBlocks } from "@/lib/personas/prompt";
import type { LlmClient, Usage } from "./llm";
import { parseReply, type Reply } from "./schema";

export type ConsultErrorCode =
  | "bad_request"
  | "unauthorized"
  | "not_found"
  | "rate_limited"
  | "quota_exceeded"
  | "guest_limit"
  | "invalid_output"
  | "upstream"
  | "not_configured"
  | "refused";

export class ConsultError extends Error {
  constructor(
    readonly code: ConsultErrorCode,
    message: string,
    readonly status: number,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function repairPrompt(error: string): string {
  return `Your last reply did not match the required format (${error.slice(0, 400)}). Reply again with only the corrected JSON object, keys in this order: mode, line, followup, matter, read, play (exactly three strings unless mode is care), avoid, principle, intent, stakes, hours (0.1 to 0.6). Pause marks only in line and followup, none in care mode. No em dashes or en dashes. No markdown, no other text.`;
}

export type GenerateResult = { reply: Reply; repaired: boolean; raw: string; usage: Usage };

function addUsage(a: Usage, b: Usage): Usage {
  const sum = (x: number | null, y: number | null) => (x === null && y === null ? null : (x ?? 0) + (y ?? 0));
  return { inputTokens: sum(a.inputTokens, b.inputTokens), outputTokens: sum(a.outputTokens, b.outputTokens), cacheReadTokens: sum(a.cacheReadTokens, b.cacheReadTokens) };
}

/**
 * Ask the model for a reply and enforce the output contract: parse, normalise,
 * validate with zod, scrub dashes. One repair retry on invalid output, then fail.
 */
export async function generateReply(
  llm: LlmClient,
  opts: { persona: PersonaId; intensity: Intensity; turns: ChatTurn[]; country?: string | null; system?: SystemBlocks },
): Promise<GenerateResult> {
  const system = opts.system ?? buildSystemPrompt(opts.persona, opts.intensity, opts.country);
  const first = await llm.complete({ system, messages: opts.turns });
  const parsed = parseReply(first.text);
  if (parsed.ok) return { reply: parsed.reply, repaired: false, raw: first.text, usage: first.usage };

  const second = await llm.complete({
    system,
    messages: [...opts.turns, { role: "assistant", content: first.text.trim() || "{}" }, { role: "user", content: repairPrompt(parsed.error) }],
    temperature: 0.3,
  });
  const reparsed = parseReply(second.text);
  if (reparsed.ok) return { reply: reparsed.reply, repaired: true, raw: second.text, usage: addUsage(first.usage, second.usage) };
  throw new ConsultError("invalid_output", `The answer came back garbled. Try again.`, 502, { detail: reparsed.error });
}
